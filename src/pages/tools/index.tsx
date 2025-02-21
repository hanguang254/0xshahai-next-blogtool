import React from 'react'
import styles from './index.module.css'
import {Tabs, Tab} from "@heroui/react";
import Hyperlane from '@/components/hyperlane/hyperlane';
import Monad from '@/components/monad/monad';

export default function Tool() {
return (
    <div className={styles.main}>
      {/* <div className={styles.content}>
        正在开发......
      </div> */}
      <Tabs aria-label="Options" size='lg' fullWidth={true} radius='full' className={styles.Tabsmain}>
        {/* <Tab key="hyperlane" title="Hyperlane查询" className={styles.HyperlaneTab}>
          <Hyperlane />
        </Tab> */}
        <Tab key="music" title="Monad" className={styles.MonadTab}>
          <Monad />
        </Tab>
        <Tab key="videos" title="开发中..." isDisabled>
          开发中... 
        </Tab>
      </Tabs>
    </div>
  )
}
