import { AppLayout } from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import styled from "styled-components";

/**
 * Connectors: the tools the assistant can read from. This build shows the
 * catalog; signing in to each service comes in a later release, so every
 * Connect button says so instead of pretending to connect.
 */

interface Connector {
	id: string;
	name: string;
	icon: string;
	/** Brand color of the tile behind the icon. */
	tint: string;
	description: string;
	access: string;
}

const CONNECTORS: Connector[] = [
	{
		id: "gmail",
		name: "Gmail",
		icon: "mail",
		tint: "#ea4335",
		description: "Search and summarise your email, draft replies for you to send.",
		access: "Read only",
	},
	{
		id: "drive",
		name: "Google Drive",
		icon: "folder_open",
		tint: "#1fa463",
		description: "Ask questions about your documents, sheets and PDFs.",
		access: "Read only",
	},
	{
		id: "outlook",
		name: "Outlook",
		icon: "calendar",
		tint: "#0f78d4",
		description: "Email and calendar from Microsoft 365.",
		access: "Read only",
	},
	{
		id: "slack",
		name: "Slack",
		icon: "tag",
		tint: "#611f69",
		description: "Catch up on channels and threads you follow.",
		access: "Read only",
	},
	{
		id: "notion",
		name: "Notion",
		icon: "notes",
		tint: "#5f5e5a",
		description: "Pages and databases from your workspace.",
		access: "Read only",
	},
	{
		id: "github",
		name: "GitHub",
		icon: "github",
		tint: "#3a3a3a",
		description: "Repositories, issues and pull requests.",
		access: "Read only",
	},
	{
		id: "files",
		name: "Local folders",
		icon: "folder_open",
		tint: "#b0603f",
		description: "Point the assistant at folders on this computer.",
		access: "On this device",
	},
];

const Page = styled.div`
  max-width: 48rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
`;

const Intro = styled.p`
  margin: 0 0 1.25rem;
  font-size: ${tokens.typography.fontSize.base};
  line-height: 1.6;
  color: ${tokens.colors.onSurfaceVariant};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.625rem;

  @media (min-width: 640px) { grid-template-columns: 1fr 1fr; }
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: ${tokens.colors.surfaceContainer};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "99")};
  border-radius: ${tokens.borderRadius.xl};
  transition: border-color ${tokens.transitions.fast};

  &:hover { border-color: ${tokens.colors.outlineVariant}; }
`;

const CardTop = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const Tile = styled.span<{ $tint: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: ${tokens.borderRadius.lg};
  background: ${({ $tint }) => $tint};
  color: #ffffff;
  flex-shrink: 0;
`;

const Name = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;

  strong {
    font-size: ${tokens.typography.fontSize.base};
    font-weight: ${tokens.typography.fontWeight.semibold};
    color: ${tokens.colors.onSurface};
  }

  span {
    font-size: ${tokens.typography.fontSize.xs};
    color: ${tokens.colors.onSurfaceVariant};
  }
`;

const Description = styled.p`
  margin: 0;
  font-size: ${tokens.typography.fontSize.sm};
  line-height: 1.5;
  color: ${tokens.colors.onSurfaceVariant};
`;

const ConnectBtn = styled.button`
  height: 30px;
  padding: 0 0.75rem;
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerHigh};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  cursor: pointer;
  flex-shrink: 0;
  transition: background ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; }
`;

const Custom = styled.button`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.625rem;
  padding: 0.875rem 1rem;
  border: 1px dashed ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.xl};
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.sm};
  text-align: left;
  cursor: pointer;

  &:hover { color: ${tokens.colors.onSurface}; border-color: ${tokens.colors.outline}; }

  strong { color: ${tokens.colors.onSurface}; font-weight: ${tokens.typography.fontWeight.medium}; }
`;

export function ConnectorsPage() {
	const { showToast } = useToast();
	const comingSoon = (name: string) => showToast(`${name} connects in the next release`, "info");

	return (
		<AppLayout title="Connectors" back="/settings">
			<Page>
				<Intro>
					Connectors let the assistant read from the tools you already use. Data is fetched and
					processed on this device, and the assistant only reads. It never sends, posts or deletes
					without asking you first.
				</Intro>
				<Grid>
					{CONNECTORS.map((c) => (
						<Card key={c.id}>
							<CardTop>
								<Tile $tint={c.tint}>
									<Icon name={c.icon} size={18} />
								</Tile>
								<Name>
									<strong>{c.name}</strong>
									<span>{c.access}</span>
								</Name>
								<ConnectBtn type="button" onClick={() => comingSoon(c.name)}>
									Connect
								</ConnectBtn>
							</CardTop>
							<Description>{c.description}</Description>
						</Card>
					))}
				</Grid>
				<Custom type="button" onClick={() => comingSoon("Custom MCP servers")}>
					<Icon name="add" size={18} />
					<span>
						<strong>Add a custom connector</strong>
						<br />
						Any MCP server running on this computer or your network
					</span>
				</Custom>
			</Page>
		</AppLayout>
	);
}
