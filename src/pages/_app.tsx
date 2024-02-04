import "@/styles/globals.css";
import type { AppProps } from "next/app";
import {NextUIProvider} from "@nextui-org/react";
import Layout from "@/components/layout/index"
import Head from "next/head";



export default function App({ Component, pageProps }: AppProps) {
  return (
    <NextUIProvider>
      <Layout>
        <Head>
          {/* 设置网页图标 */}
          <link rel="icon" href="/a.jpg" />
          <title>0xshahai 沙海</title>
        </Head>
        <Component {...pageProps} />
      </Layout>
    </NextUIProvider>
  );
}
