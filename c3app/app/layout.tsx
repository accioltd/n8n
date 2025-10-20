import type { Metadata } from "next";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";
import { Notifications } from "@mantine/notifications";

import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from "@mantine/core";

export const metadata: Metadata = {
  title: "C3App",
  description: "By C3Plan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider>
          <Notifications
            position="bottom-right"
            zIndex={1000}
            limit={5}
            containerWidth={350}
          />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
