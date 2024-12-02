import { Card, CardContent, Typography } from '@mui/material'
import React from 'react'
import { Player } from '../ts/constants';

export interface PlayerCardProps {
  player: Player;
};

const PlayerCard: React.FC<PlayerCardProps> = ({ player }) => {
  return (
    <>
      <Card>
        <CardContent>
          <Typography>{player.name}</Typography>
          <Typography>{player.points}</Typography>
        </CardContent>
      </Card>
    </>
  )
};

export default PlayerCard;