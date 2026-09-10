export type SignInMode = "choose" | "web" | "token" | "device";

export interface SignInProps {
  onBack: () => void;
  onLocal: () => void;
}
