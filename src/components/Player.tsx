import { Card, CardContent, Typography } from '@mui/material'
import React from 'react'
import { Player } from '../ts/constants';

export interface PlayerCardProps {
  player: Player;
};

export default function PlayerCard() {
  return (
    <>
      <Card>
        <CardContent>
          <Typography>First Last</Typography>
          <Typography>123</Typography>
        </CardContent>
      </Card>
    </>
  )
}