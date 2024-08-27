import React from 'react'
import { Button, Box, Typography } from "@mui/material"

interface MobileLandingProps {
  handleSetMobile: (mobile: boolean) => void;
}

const MobileLanding: React.FC<MobileLandingProps> = ({ handleSetMobile }) => {
  const sendToRoot = (isMobile: boolean) => {
    handleSetMobile(isMobile)
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", pt: "2rem", flexDirection: "column" }}>
      <Typography sx={{ fontSize: "5rem", fontWeight: 600, textAlign: "center" }}>Bank!</Typography>
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Button variant='contained' sx={{ backgroundColor: "green", width: "30%", justifyContent: "center" }} size='large' onClick={() => sendToRoot(true)}>
          Click For Mobile
        </Button>
      </Box>
    </Box>
  )
};

export default MobileLanding;