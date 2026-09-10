export type SignInMode = "choose" | "token" | "device";

export interface SignInProps {
  onBack: () => void;
  onLocal: () => void;
}
