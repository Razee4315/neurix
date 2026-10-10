import { Icon } from "@/components/ui/Icon";
import { SetupArt } from "@/components/ui/Illustrations";
import { ModelMeters } from "@/components/ui/Meter";
import { NeurixLogo } from "@/components/ui/NeurixLogo";
import { useAppContext } from "@/context/AppContext";
import { modelService, settingsService } from "@/services";
import type { ModelInfo } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { nominalRamGb, recommendModel } from "@/utils/modelFit";
import { vibrate } from "@/utils/platform";
import { useModelDownload } from "@/utils/useModelDownload";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

/* First run is one decision: which model to download. Neurix can make that
   decision from the device's memory, so this screen proposes a model and
   offers a single button. From here to a first chat is one tap and one
   download, with the full store a tap away for anyone who wants to choose. */

const rise = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: ${tokens.surfaces.page};
  color: ${tokens.colors.onSurface};
  padding: max(1rem, env(safe-area-inset-top)) 1.5rem max(1.25rem, env(safe-area-inset-bottom));
  overflow-y: auto;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const LogoGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const BrandName = styled.span`
  font-family: ${tokens.typography.fontFamily.headline};
  font-weight: ${tokens.typography.fontWeight.bold};
  letter-spacing: 0.04em;
  color: ${tokens.colors.primary};
`;

const Main = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  max-width: 26rem;
  margin: 0 auto;
  padding: 1.5rem 0;
  animation: ${rise} 0.35s ease-out both;
`;

const Art = styled(SetupArt)`
  margin: 0 0 1rem -0.5rem;
`;

const Eyebrow = styled.p`
  font-size: 11px;
  font-weight: ${tokens.typography.fontWeight.bold};
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${tokens.colors.primary};
`;

const Title = styled.h1`
  margin-top: 0.5rem;
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: clamp(1.75rem, 7vw, 2.25rem);
  font-weight: ${tokens.typography.fontWeight.bold};
  line-height: 1.1;
`;

const Lead = styled.p`
  margin-top: 0.75rem;
  font-size: ${tokens.typography.fontSize.base};
  line-height: ${tokens.typography.lineHeight.relaxed};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Card = styled.section`
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: ${tokens.borderRadius.xl};
  background: ${tokens.colors.surfaceContainerLow};
  border: 1px solid ${alpha(tokens.colors.primary, "40")};
  min-height: 9.5rem;
`;

const CardHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
`;

const ModelName = styled.h2`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.xl};
  font-weight: ${tokens.typography.fontWeight.bold};
`;

const ModelSize = styled.span`
  flex-shrink: 0;
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const ModelText = styled.p`
  margin-top: 0.375rem;
  font-size: ${tokens.typography.fontSize.sm};
  line-height: 1.5;
  color: ${tokens.colors.onSurfaceVariant};
`;

const Meters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem 1rem;
  margin-top: 0.625rem;
`;

const Reason = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.75rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.secondary};
`;

const CardPlaceholder = styled.p`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Primary = styled.button`
  margin-top: 1rem;
  width: 100%;
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimaryFixed};
  font-family: ${tokens.typography.fontFamily.label};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.bold};
  cursor: pointer;
  transition: transform 0.1s ease, filter ${tokens.transitions.fast};

  &:hover { filter: brightness(1.06); }
  &:active { transform: scale(0.98); }
  &:disabled { opacity: 0.5; cursor: default; }
  &:focus-visible { outline: 2px solid ${tokens.colors.onSurface}; outline-offset: 2px; }
`;

const Secondary = styled.button`
  margin-top: 0.5rem;
  width: 100%;
  min-height: 44px;
  border: none;
  background: none;
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.semibold};
  cursor: pointer;

  &:hover { color: ${tokens.colors.onSurface}; }
`;

const Facts = styled.ul`
  list-style: none;
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.375rem 1.25rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};

  li {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }
`;

export function OnboardingScreen() {
	const navigate = useNavigate();
	const { updateSettings } = useAppContext();
	const download = useModelDownload();
	const [model, setModel] = useState<ModelInfo | null>(null);
	const [deviceMemory, setDeviceMemory] = useState<number | null>(null);
	const [failed, setFailed] = useState(false);
	const [starting, setStarting] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const [catalog, memory] = await Promise.all([
					modelService.getCatalog(),
					settingsService
						.getDeviceInfo()
						.then((info) => info.total_memory_bytes)
						.catch(() => null),
				]);
				if (cancelled) return;
				setDeviceMemory(memory);
				setModel(recommendModel(catalog, memory));
			} catch {
				if (!cancelled) setFailed(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Either way out ends first-run setup: it is not shown again.
	const done = () => updateSettings({ onboarding_done: true }).catch(() => {});

	const browse = () => {
		vibrate(5);
		done();
		navigate("/store");
	};

	const start = async () => {
		if (!model || starting) return;
		setStarting(true);
		try {
			if (await download(model, deviceMemory)) done();
		} finally {
			setStarting(false);
		}
	};

	const ramGb = nominalRamGb(deviceMemory);

	return (
		<Container data-testid="onboarding-screen">
			<Header>
				<LogoGroup>
					<NeurixLogo size={28} />
					<BrandName>NEURIX</BrandName>
				</LogoGroup>
			</Header>

			<Main>
				<Art />
				<Eyebrow>One step to set up</Eyebrow>
				<Title>Pick the model that runs on this device</Title>
				<Lead>
					Neurix answers with an AI model stored on your device. It is one download; after that
					everything works with no connection.
				</Lead>

				<Card aria-live="polite" aria-busy={!model && !failed}>
					{model ? (
						<>
							<CardHead>
								<ModelName>{model.name}</ModelName>
								<ModelSize>{model.size_label}</ModelSize>
							</CardHead>
							<ModelText>{model.description}</ModelText>
							<Meters>
								<ModelMeters quality={model.quality} speed={model.speed} />
							</Meters>
							<Reason>
								<Icon name="check_circle" size={13} />
								{ramGb
									? `Our pick for your ${ramGb} GB of memory`
									: "A good all-rounder to start with"}
							</Reason>
						</>
					) : failed ? (
						<CardPlaceholder>
							The model list could not be loaded. You can still pick one from the store.
						</CardPlaceholder>
					) : (
						<CardPlaceholder>Checking what this device can run…</CardPlaceholder>
					)}
				</Card>

				<Primary type="button" onClick={start} disabled={!model || starting}>
					<Icon name="download" size={20} />
					{model ? `Download · ${model.size_label}` : "Download"}
				</Primary>
				<Secondary type="button" onClick={browse}>
					Choose a different model
				</Secondary>
			</Main>

			<Facts>
				<li>
					<Icon name="verified_user" size={13} color={tokens.colors.secondary} />
					Chats never leave this device
				</li>
				<li>
					<Icon name="cloud_off" size={13} color={tokens.colors.secondary} />
					Works offline
				</li>
				<li>
					<Icon name="favorite" size={13} color={tokens.colors.secondary} />
					Free, no account
				</li>
			</Facts>
		</Container>
	);
}
