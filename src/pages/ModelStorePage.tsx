import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/theme/tokens";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

/* ── Mock Data ── */

const MODELS = [
	{
		name: "Llama 3 8B",
		desc: "Great for chat, reasoning, and creative writing.",
		size: "4.1 GB",
		tag: "Popular",
	},
	{
		name: "Mistral 7B",
		desc: "Fast and efficient for general tasks.",
		size: "3.8 GB",
		tag: "Fast",
	},
	{
		name: "CodeLlama 13B",
		desc: "Optimized for code generation and debugging.",
		size: "7.2 GB",
		tag: "Code",
	},
	{
		name: "Phi-2",
		desc: "Compact model, ideal for low-end devices.",
		size: "1.6 GB",
		tag: "Tiny",
	},
	{
		name: "Gemma 2B",
		desc: "Lightweight model by Google for on-device use.",
		size: "1.4 GB",
		tag: "Tiny",
	},
];

const FILTERS = ["All", "Popular", "Code", "Fast", "Tiny"];

/* ── Styles ── */

const Page = styled.div`
  padding: 1.25rem;
`;

const Title = styled.h1`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: clamp(1.75rem, 6vw, 2.25rem);
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  margin-bottom: 1.25rem;
`;

const SearchBox = styled.div`
  position: relative;
  margin-bottom: 0.75rem;
`;

const SearchInput = styled.input`
  width: 100%;
  height: 44px;
  padding: 0 1rem 0 2.5rem;
  background: ${tokens.colors.surfaceContainerHighest};
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurface};
  outline: none;

  &::placeholder {
    color: ${tokens.colors.outline};
  }
  &:focus {
    box-shadow: inset 0 -2px 0 ${tokens.colors.primary};
  }
`;

const SearchIconWrap = styled.div`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: ${tokens.colors.onSurfaceVariant};
  display: flex;
`;

const Chips = styled.div`
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  margin-bottom: 1.25rem;
  &::-webkit-scrollbar { display: none; }
  scrollbar-width: none;
`;

const Chip = styled.button<{ $active: boolean }>`
  flex-shrink: 0;
  padding: 0.375rem 0.75rem;
  border-radius: ${tokens.borderRadius.md};
  border: none;
  font-size: 11px;
  font-weight: ${tokens.typography.fontWeight.bold};
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all ${tokens.transitions.fast};
  background: ${({ $active }) =>
		$active ? tokens.colors.primary : tokens.colors.surfaceContainerHigh};
  color: ${({ $active }) =>
		$active ? tokens.colors.onPrimaryFixed : tokens.colors.onSurfaceVariant};

  &:hover {
    background: ${({ $active }) =>
			$active ? tokens.colors.primary : tokens.colors.surfaceBright};
  }
  &:active { transform: scale(0.95); }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Cards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Card = styled.button`
  width: 100%;
  text-align: left;
  background: ${tokens.colors.surfaceContainerLow};
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  padding: 1rem;
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, transform 0.1s ease;
  display: flex;
  align-items: center;
  gap: 1rem;
  animation: ${slideIn} 0.3s ease-out both;

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
  &:active { transform: scale(0.99); }
`;

const CardInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const CardName = styled.h3`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  margin-bottom: 0.125rem;
`;

const CardDesc = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardRight = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.375rem;
  flex-shrink: 0;
`;

const CardSize = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const DlIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: ${tokens.borderRadius.md};
  background: ${tokens.colors.surfaceContainerHighest};
  display: flex;
  align-items: center;
  justify-content: center;
`;

/* ── Component ── */

export function ModelStorePage() {
	const navigate = useNavigate();
	const [filter, setFilter] = useState(0);
	const [search, setSearch] = useState("");

	const filtered = MODELS.filter((m) => {
		const matchesSearch =
			!search ||
			m.name.toLowerCase().includes(search.toLowerCase()) ||
			m.desc.toLowerCase().includes(search.toLowerCase());
		const matchesFilter = filter === 0 || m.tag === FILTERS[filter];
		return matchesSearch && matchesFilter;
	});

	return (
		<AppLayout>
			<Page>
				<Title>Model Store</Title>

				<SearchBox>
					<SearchIconWrap>
						<Icon name="search" size={18} />
					</SearchIconWrap>
					<SearchInput
						placeholder="Search models..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</SearchBox>

				<Chips>
					{FILTERS.map((f, i) => (
						<Chip key={f} $active={i === filter} onClick={() => setFilter(i)}>
							{f}
						</Chip>
					))}
				</Chips>

				{filtered.length === 0 ? (
					<EmptyState message="No models match your search" />
				) : (
					<Cards>
						{filtered.map((m, i) => (
							<Card
								key={m.name}
								onClick={() => navigate("/downloading")}
								style={{ animationDelay: `${i * 50}ms` }}
							>
								<CardInfo>
									<CardName>{m.name}</CardName>
									<CardDesc>{m.desc}</CardDesc>
								</CardInfo>
								<CardRight>
									<CardSize>{m.size}</CardSize>
									<DlIcon>
										<Icon
											name="download"
											size={18}
											color={tokens.colors.primary}
										/>
									</DlIcon>
								</CardRight>
							</Card>
						))}
					</Cards>
				)}
			</Page>
		</AppLayout>
	);
}
