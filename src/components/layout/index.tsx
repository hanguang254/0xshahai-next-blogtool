import React from 'react'
import Navbar from '@/components/navbar/index'



export default function Layout({ children}:{children:any}) {
  return (
    <>
      <Navbar></Navbar>
      { children }
    </>
    
  )
}
