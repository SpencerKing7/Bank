import React, { useState } from 'react'
import Desktop from './pages/Desktop'
import Mobile from './Mobile'
// import { Routes, Route, BrowserRouter } from 'react-router-dom'
// import { CssBaseline } from '@mui/material'

export default function App() {
  const [mobile, setMobile] = useState(false);

  const handleSetMobile = (isMobile: boolean) => {
    setMobile(isMobile);
  };

  return (
    <>
      {!mobile ?
        <Desktop handleSetMobile={handleSetMobile} />
        :
        <Mobile />
      }
    </>
  )
};