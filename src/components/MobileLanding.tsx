import React from 'react'
import { Button, Box, Typography } from "@mui/material"

export default function MobileLanding() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", pt: "2rem", flexDirection: "column" }}>
      <Typography sx={{ fontSize: "5rem", fontWeight: 600, textAlign: "center" }}>Bank!</Typography>
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Button variant='contained' sx={{ backgroundColor: "green", width: "30%", justifyContent: "center" }} size='large'>
          Click For Mobile
        </Button>
      </Box>
    </Box>
  )
};