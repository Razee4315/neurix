import "styled-components";
import type { Theme } from "./theme/theme";

declare module "styled-components" {
	export interface DefaultTheme extends Theme {}
}
