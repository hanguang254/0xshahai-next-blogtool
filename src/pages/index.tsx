import { Inter } from "next/font/google";
import Head from "next/head";
import Image from "next/image";
import {Button, ButtonGroup} from "@nextui-org/react";


const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <>
      <Head>
        <title>Create Next App</title>
      </Head>
      <main>
        <Button color="primary">button</Button>
      </main>
    </>
  );
}
