//! Just enough IMAP to read the newest emails in a Gmail inbox, over rustls.
//!
//! The desktop build reads Gmail with the `imap` crate over the platform's
//! TLS, which on Android would mean cross-compiling OpenSSL. Phones instead
//! speak the four commands needed here (LOGIN, EXAMINE, FETCH, LOGOUT) over
//! rustls, the TLS stack the app already ships for model downloads.
//!
//! The mailbox is opened read-only (EXAMINE) and messages are fetched with
//! BODY.PEEK, so nothing is marked as read. Only the first part of each
//! message is fetched, so attachments are not downloaded over mobile data.

#![cfg_attr(not(mobile), allow(dead_code))]

use std::io::{BufRead, BufReader, Read, Write};

const HOST: &str = "imap.gmail.com";
const PORT: u16 = 993;
/// Bytes of each message fetched: headers and the start of the text.
const MESSAGE_BYTES: usize = 64 * 1024;
/// Longest response line accepted from the server.
const MAX_LINE: u64 = 64 * 1024;
/// Largest literal accepted, a little over what was asked for.
const MAX_LITERAL: usize = MESSAGE_BYTES + 1024;

/// One tagged command's response: the text lines, and the raw messages
/// (literals that follow a `* n FETCH` line) with their sequence numbers.
struct Response {
    lines: Vec<String>,
    messages: Vec<(u32, Vec<u8>)>,
}

fn io_err(e: std::io::Error) -> String {
    format!("Lost the connection to Gmail: {e}")
}

fn read_line<R: BufRead>(r: &mut R) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    let n = r.by_ref().take(MAX_LINE).read_until(b'\n', &mut buf).map_err(io_err)?;
    if n == 0 {
        return Err("Gmail closed the connection.".into());
    }
    if !buf.ends_with(b"\n") {
        return Err("Gmail sent a line that was too long.".into());
    }
    while matches!(buf.last(), Some(b'\n' | b'\r')) {
        buf.pop();
    }
    Ok(buf)
}

/// The size of the literal announced at the end of `line` (`... {123}`).
fn literal_len(line: &[u8]) -> Option<usize> {
    let rest = line.strip_suffix(b"}")?;
    let open = rest.iter().rposition(|&b| b == b'{')?;
    std::str::from_utf8(&rest[open + 1..]).ok()?.parse().ok()
}

/// The sequence number of a `* n FETCH ...` line.
fn fetch_seq(line: &str) -> Option<u32> {
    let mut parts = line.split(' ');
    if parts.next()? != "*" {
        return None;
    }
    let seq = parts.next()?.parse().ok()?;
    parts.next()?.eq_ignore_ascii_case("FETCH").then_some(seq)
}

fn read_response<R: BufRead>(r: &mut R, tag: &str) -> Result<Response, String> {
    let mut lines = Vec::new();
    let mut messages = Vec::new();
    loop {
        let line = read_line(r)?;
        if let Some(len) = literal_len(&line) {
            if len > MAX_LITERAL {
                return Err("Gmail sent more than was asked for.".into());
            }
            let mut literal = vec![0; len];
            r.read_exact(&mut literal).map_err(io_err)?;
            let text = String::from_utf8_lossy(&line).into_owned();
            if let Some(seq) = fetch_seq(&text) {
                messages.push((seq, literal));
            }
            lines.push(text);
            continue;
        }
        let text = String::from_utf8_lossy(&line).into_owned();
        if let Some(status) = text.strip_prefix(tag).and_then(|s| s.strip_prefix(' ')) {
            if status.get(..2).is_some_and(|s| s.eq_ignore_ascii_case("OK")) {
                lines.push(text);
                return Ok(Response { lines, messages });
            }
            return Err(status.to_string());
        }
        lines.push(text);
    }
}

/// An IMAP quoted string. Line breaks can't be quoted, so they are refused.
fn quote(s: &str) -> Result<String, String> {
    if s.contains(['\r', '\n']) {
        return Err("The address and password can't contain line breaks.".into());
    }
    Ok(format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\"")))
}

fn command<S: Read + Write>(conn: &mut BufReader<S>, tag: &str, cmd: &str) -> Result<Response, String> {
    let stream = conn.get_mut();
    stream.write_all(format!("{tag} {cmd}\r\n").as_bytes()).map_err(io_err)?;
    stream.flush().map_err(io_err)?;
    read_response(conn, tag)
}

/// Sign in on an open connection and read the newest `limit` messages,
/// newest first, as raw (possibly cut short) RFC 822 bytes.
pub(crate) fn newest_messages<S: Read + Write>(
    stream: S,
    email: &str,
    password: &str,
    limit: u32,
) -> Result<Vec<Vec<u8>>, String> {
    let mut conn = BufReader::new(stream);
    let greeting = String::from_utf8_lossy(&read_line(&mut conn)?).into_owned();
    if !greeting.starts_with("* OK") {
        return Err(format!("Gmail didn't accept the connection: {greeting}"));
    }

    let login = format!("LOGIN {} {}", quote(email)?, quote(password)?);
    command(&mut conn, "a1", &login).map_err(|_| {
        "Gmail refused the sign-in. Check the address and use an app password, not your Google password."
            .to_string()
    })?;

    let inbox = command(&mut conn, "a2", "EXAMINE INBOX")?;
    let total = inbox
        .lines
        .iter()
        .find_map(|l| {
            let rest = l.strip_prefix("* ")?;
            let (n, word) = rest.split_once(' ')?;
            word.eq_ignore_ascii_case("EXISTS").then(|| n.parse::<u32>().ok()).flatten()
        })
        .unwrap_or(0);

    let mut messages = Vec::new();
    if total > 0 {
        let first = total.saturating_sub(limit.max(1) - 1).max(1);
        let fetched = command(
            &mut conn,
            "a3",
            &format!("FETCH {first}:{total} BODY.PEEK[]<0.{MESSAGE_BYTES}>"),
        )?;
        messages = fetched.messages;
        messages.sort_by(|a, b| b.0.cmp(&a.0));
    }
    // The answer is already in hand; a failed goodbye doesn't change it.
    let _ = command(&mut conn, "a4", "LOGOUT");
    Ok(messages.into_iter().map(|(_, raw)| raw).collect())
}

/// Connect to Gmail over TLS and read the newest `limit` messages.
pub(crate) fn fetch_gmail(email: &str, password: &str, limit: u32) -> Result<Vec<Vec<u8>>, String> {
    use rustls::pki_types::ServerName;
    use rustls::{ClientConfig, ClientConnection, RootCertStore, StreamOwned};
    use std::net::TcpStream;
    use std::sync::Arc;
    use std::time::Duration;

    let roots: RootCertStore = webpki_roots::TLS_SERVER_ROOTS.iter().cloned().collect();
    let config = ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
        .with_safe_default_protocol_versions()
        .map_err(|e| e.to_string())?
        .with_root_certificates(roots)
        .with_no_client_auth();
    let server = ServerName::try_from(HOST).map_err(|e| e.to_string())?;
    let tls = ClientConnection::new(Arc::new(config), server).map_err(|e| e.to_string())?;
    let tcp = TcpStream::connect((HOST, PORT)).map_err(|e| format!("Couldn't reach Gmail: {e}"))?;
    let timeout = Some(Duration::from_secs(30));
    tcp.set_read_timeout(timeout).map_err(io_err)?;
    tcp.set_write_timeout(timeout).map_err(io_err)?;
    newest_messages(StreamOwned::new(tls, tcp), email, password, limit)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    /// A server that answers from a script and records what it was sent.
    struct Scripted {
        replies: Cursor<Vec<u8>>,
        sent: Vec<u8>,
    }

    impl Read for Scripted {
        fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
            self.replies.read(buf)
        }
    }

    impl Write for Scripted {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.sent.extend_from_slice(buf);
            Ok(buf.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    fn server(script: &[u8]) -> Scripted {
        Scripted { replies: Cursor::new(script.to_vec()), sent: Vec::new() }
    }

    const MAIL_A: &[u8] = b"From: Ana <ana@example.com>\r\nSubject: Rota\r\n\r\nNights: Tom.\r\n";
    const MAIL_B: &[u8] = b"From: Bo <bo@example.com>\r\nSubject: Hi\r\n\r\nHello there.\r\n";

    fn session_script() -> Vec<u8> {
        let mut s = Vec::new();
        s.extend_from_slice(b"* OK Gimap ready\r\n");
        s.extend_from_slice(b"a1 OK ana@example.com authenticated (Success)\r\n");
        s.extend_from_slice(b"* FLAGS (\\Seen)\r\n* 7 EXISTS\r\n* 0 RECENT\r\na2 OK [READ-ONLY] INBOX selected.\r\n");
        // Out of order on purpose: the reader must sort newest first.
        s.extend_from_slice(format!("* 6 FETCH (BODY[]<0> {{{}}}\r\n", MAIL_A.len()).as_bytes());
        s.extend_from_slice(MAIL_A);
        s.extend_from_slice(b")\r\n");
        s.extend_from_slice(format!("* 7 FETCH (BODY[]<0> {{{}}}\r\n", MAIL_B.len()).as_bytes());
        s.extend_from_slice(MAIL_B);
        s.extend_from_slice(b" FLAGS (\\Seen))\r\n");
        s.extend_from_slice(b"a3 OK Success\r\n");
        s.extend_from_slice(b"* BYE LOGOUT Requested\r\na4 OK 73 good day\r\n");
        s
    }

    #[test]
    fn reads_newest_messages_read_only() {
        let mut stream = server(&session_script());
        let mails = newest_messages(&mut stream, "ana@example.com", "abcd efgh", 2).expect("session");
        assert_eq!(mails, vec![MAIL_B.to_vec(), MAIL_A.to_vec()]);

        let sent = String::from_utf8(stream.sent).unwrap();
        assert!(sent.contains("a1 LOGIN \"ana@example.com\" \"abcd efgh\"\r\n"), "{sent}");
        assert!(sent.contains("a2 EXAMINE INBOX\r\n"), "{sent}");
        assert!(sent.contains("a3 FETCH 6:7 BODY.PEEK[]<0.65536>\r\n"), "{sent}");
        assert!(sent.contains("a4 LOGOUT\r\n"), "{sent}");
    }

    #[test]
    fn empty_inbox_fetches_nothing() {
        let script = b"* OK hi\r\na1 OK in\r\n* 0 EXISTS\r\na2 OK [READ-ONLY] done\r\na4 OK bye\r\n";
        let mut stream = server(script);
        let mails = newest_messages(&mut stream, "a@b.c", "pw", 8).expect("session");
        assert!(mails.is_empty());
        assert!(!String::from_utf8(stream.sent).unwrap().contains("FETCH"));
    }

    #[test]
    fn refused_sign_in_is_explained() {
        let script = b"* OK hi\r\na1 NO [AUTHENTICATIONFAILED] Invalid credentials\r\n";
        let err = newest_messages(server(script), "a@b.c", "wrong", 8).unwrap_err();
        assert!(err.contains("app password"), "{err}");
    }

    #[test]
    fn oversized_literal_is_refused() {
        let script = format!("* OK hi\r\na1 OK in\r\n* 1 EXISTS\r\na2 OK done\r\n* 1 FETCH (BODY[]<0> {{{}}}\r\n", MAX_LITERAL + 1);
        let err = newest_messages(server(script.as_bytes()), "a@b.c", "pw", 1).unwrap_err();
        assert!(err.contains("more than was asked"), "{err}");
    }

    #[test]
    fn quoting_escapes_and_refuses_line_breaks() {
        assert_eq!(quote(r#"a"b\c"#).unwrap(), r#""a\"b\\c""#);
        assert!(quote("a\r\nb").is_err());
    }

    #[test]
    fn literal_and_fetch_parsing() {
        assert_eq!(literal_len(b"* 3 FETCH (BODY[]<0> {120}"), Some(120));
        assert_eq!(literal_len(b"* 3 FETCH (FLAGS ())"), None);
        assert_eq!(fetch_seq("* 3 FETCH (BODY[]<0> {120}"), Some(3));
        assert_eq!(fetch_seq("* 3 EXISTS"), None);
    }
}
