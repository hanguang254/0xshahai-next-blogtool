import React, { useEffect } from 'react'
import styles from './index.module.css'
import {Card, CardHeader, CardBody, CardFooter, Avatar, Button} from "@nextui-org/react";
import Image from 'next/image';



export default function Owner() {
  const [isFollowed, setIsFollowed] = React.useState(false);


  useEffect(() => {
    // Check if running in the browser environment
    if (typeof window !== 'undefined') {
      // Your browser-specific code here
    }
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.avatarContainer}>
        <Avatar src="/a.jpg" className="w-28 h-28" />
      </div>
      <div className={styles.titleContainer}><h2>沙海 0xshahai</h2></div>

      <div className={styles.content}>
        <h2>拥抱Web3.0</h2>
        <h2>机会和风险同在保护好自己</h2>
        <h2>机会永远比风险多</h2>
      </div>

      <div className={styles.twCard}>
        <Card className="max-w-[340px]">
          <CardHeader className="justify-between">
            <div className="flex gap-5">
              <Avatar isBordered radius="full" size="md" src="/a.jpg" />
              <div className="flex flex-col gap-1 items-start justify-center">
                <h4 className="text-small font-semibold leading-none text-default-600">沙海</h4>
                <h5 className="text-small tracking-tight text-default-400">@wbgz888</h5>
              </div>
            </div>
            <Button
              className={isFollowed ? "bg-transparent text-foreground border-default-200" : ""}
              color="primary"
              radius="full"
              size="sm"
              variant={isFollowed ? "bordered" : "solid"}
              onPress={() => {window.open('https://twitter.com/wbgz888')}}
            >
              Follow
            </Button>
          </CardHeader>
          <CardBody className="px-3 py-0 text-small text-default-400">
            <p>
              看不懂人性是所有痛苦的根源,狭隘的认知是所有贫穷的源头
            </p>
            <span className="pt-2">
              沙海 0xshahai
            </span>
          </CardBody>
          <CardFooter className="gap-3">
            <div className="flex gap-1">
              <p className="font-semibold text-default-400 text-small">1K</p>
              <p className=" text-default-400 text-small">Following</p>
            </div>
            <div className="flex gap-1">
              <p className="font-semibold text-default-400 text-small">1K</p>
              <p className="text-default-400 text-small">Followers</p>
            </div>
          </CardFooter>
        </Card>
      </div>

      <div className={styles.footer}>
        
          <a href="https://twitter.com/wbgz888" target='_bank' className={styles.link}>
            
            <Image src='/twitter.svg' alt={''} color='' width={24} height={24}></Image> Twitter
          </a>
          <a href="https://github.com/hanguang254" target='_bank' className={styles.link}>
            <Image src='/github.svg' alt={''} color='' width={24} height={24}></Image>Github
          </a>
        
      </div>
    </div>
  )
}
