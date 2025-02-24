import "@/styles/globals.css";
import type { AppProps } from "next/app";
import {HeroUIProvider} from "@heroui/react";
import Layout from "@/components/layout/index"
import Head from "next/head";

import '@rainbow-me/rainbowkit/styles.css';

import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
  Chain
} from '@rainbow-me/rainbowkit';
import { createConfig, http, WagmiProvider } from 'wagmi';
import {
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
  sepolia,
} from 'wagmi/chains';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";

import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  rainbowWallet,
  metaMaskWallet
} from '@rainbow-me/rainbowkit/wallets';

const connectors = connectorsForWallets([
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet],
    },
  ],
  {
    appName: 'My RainbowKit App',
    projectId: 'a6ad9782f7962541cf0a1de03ae8aa87',
  }
);

const monad_test = {
  id: 10143,
  name: 'Monadtest',
  iconUrl: 'https://imagedelivery.net/cBNDGgkrsEA-b_ixIp9SkQ/MON.png/public',
  iconBackground: '#fff',
  nativeCurrency: { name: 'monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'monadtest', url: 'https://testnet.monadexplorer.com/' },
  }
} as const satisfies Chain;


const config = createConfig({
  connectors,
  chains: [sepolia, monad_test],
  transports: {
    [sepolia.id]: http(),
    [monad_test.id]: http()
  }
});

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <HeroUIProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider 
            theme={darkTheme({
              accentColor:'linear-gradient(270deg, rgb(51, 212, 250) 0%, rgb(23, 243, 221) 100%)',
              accentColorForeground:'black'
            })}
            initialChain={monad_test}
            >

            {/* APP页面主题 */}
            <Layout>
              <Head>
                {/* 设置网页图标 */}
                <link rel="icon" href="/a.jpg" />
                <title>0xshahai 沙海</title>
              </Head>
              <Component {...pageProps} />
            </Layout>

          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </HeroUIProvider>
  );
}
