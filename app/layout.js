import './globals.css';

export const metadata = {
  title: 'Planner de equipo',
  description: 'Planner de equipo compartido, hecho en el Laboratorio Code',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
