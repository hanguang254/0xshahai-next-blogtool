import React from 'react'
import styles from './index.module.css'
import {Tabs, Tab} from "@nextui-org/react";
import Hyperlane from '@/components/hyperlane/hyperlane';


export default function Tool() {
return (
    <div className={styles.main}>
      {/* <div className={styles.content}>
        正在开发......
      </div> */}
      <Tabs aria-label="Options" size='lg' fullWidth={true} radius='full'>
        <Tab key="hyperlane" title="Hyperlane查询" className={styles.HyperlaneTab}>
          <Hyperlane />
        </Tab>
        <Tab key="music" title="开发中..." isDisabled>
          开发中... 
        </Tab>
        <Tab key="videos" title="开发中..." isDisabled>
          开发中... 
        </Tab>
      </Tabs>
    </div>
  )
}
