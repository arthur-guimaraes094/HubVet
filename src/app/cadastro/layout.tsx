import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cadastro',
  description: 'Crie sua conta profissional no HubVet, o prontuário expresso digital veterinário.',
};

export default function CadastroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
