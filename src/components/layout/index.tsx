import React from 'react'
import Navbar from '@/components/navbar/index'
import styles from './index.module.css'

export default function Layout({ children}:{children:any}) {
  return (
    <div className={styles.layout}>
      <Navbar></Navbar>
      <div className={styles.content}>
        { children }
      </div>
    </div>
  )
}
