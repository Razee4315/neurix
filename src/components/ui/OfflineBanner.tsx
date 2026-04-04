import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/theme/tokens";
import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";

const slideDown = keyframes`
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: ${tokens.colors.error}22;
  border-bottom: 1px solid ${tokens.colors.error}33;
  animation: ${slideDown} 0.2s ease-out;
`;

const BannerText = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.error};
  font-weight: ${tokens.typography.fontWeight.medium};
`;

export function useOnlineStatus() {
	const [isOnline, setIsOnline] = useState(navigator.onLine);

	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	return isOnline;
}

export function OfflineBanner() {
	const isOnline = useOnlineStatus();

	if (isOnline) return null;

	return (
		<Banner>
			<Icon name="cloud_off" size={16} color={tokens.colors.error} />
			<BannerText>No internet connection. Downloads require WiFi or mobile data.</BannerText>
		</Banner>
	);
}
