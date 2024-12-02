import React, { useEffect, useState } from 'react';
import { Card, CardContent, Grid, Typography, Box } from "@mui/material"
import numbers from '../numbers.json'
import { useMediaQuery, useTheme } from '@mui/material';
import MobileLanding from '../components/MobileLanding';
import { Player } from '../ts/constants';
import PlayerCard from '../components/PlayerCard';

interface DesktopProps {
  handleSetMobile: (mobile: boolean) => void;
};

const Desktop: React.FC<DesktopProps> = ({ handleSetMobile }) => {
  const [roundTotal, setRoundTotal] = useState(0);
  const [rollNum, setRollNum] = useState(1);
  const [roundNum, setRoundNum] = useState(1);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [arrPlayers, setArrPlayers] = useState<Player[]>();

  useEffect(() => {
    const testPlayer: Player[] = [{
      id: 1,
      name: "Kazuki",
      points: 250
    }]

    setArrPlayers(testPlayer)
  }, [])

  const setIsMobile = (isMobile: boolean) => {
    handleSetMobile(isMobile);
  }

  const clickNumber = (value: number) => {
    var newBankTotal = roundTotal + value;
    if (rollNum > 3) {
      if (value === 7) {
        setRoundTotal(0);
        setRollNum(1);
        setRoundNum(roundNum + 1)
        return
      } else {
        setRoundTotal(newBankTotal);
        setRollNum(rollNum + 1);
        return
      }
    } else {
      if (value === 7) {
        setRoundTotal(roundTotal + 70);
        setRollNum(rollNum + 1);
        return
      }
      setRoundTotal(newBankTotal);
      setRollNum(rollNum + 1);
      return
    }
  };

  const reset = () => {
    setRoundTotal(0);
    setRollNum(1);
    setRoundNum(roundNum + 1);
  };

  const clickDoubles = () => {
    if (rollNum <= 3) {
      return
    } else {
      setRoundTotal(roundTotal * 2);
      setRollNum(rollNum + 1);
    }
  };

  const styles = {
    card: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: "pointer",
      backgroundColor: "#c7fbc4"
    },
    cardContent: {
      fontSize: '2rem',
      fontWeight: 500,
      textAlign: 'center',
      cursor: "pointer"
    },
    cardContentDouble: {
      fontSize: '1rem',
      fontWeight: 500,
      textAlign: 'center',
      cursor: "pointer"
    },
    cardContentDoubleDisable: {
      fontSize: '1rem',
      fontWeight: 500,
      textAlign: 'center',
      backgroundColor: 'lightgray',
      cursor: 'not-allowed'
    },
    cardDanger: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'red',
      cursor: 'pointer'
    },
    cardGreen: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'green',
      cursor: 'pointer'
    },
    cardGray: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'lightgray',
      cursor: 'pointer'
    }
  };

  return (
    <>
      {!isMobile ?
        <>
          <Typography sx={{ textAlign: "center", fontWeight: 800, fontSize: "5rem" }}>Bank!</Typography>
          <Box sx={{ p: "2rem" }}>
            {/* Left */}
            <Grid container spacing={2}>
              <Grid item md={4}>
                <Grid container spacing={3}>
                  {numbers.dice.map((diceSide) => (
                    <Grid item xs={4} key={diceSide.value}>
                      <Card sx={(rollNum > 3 && diceSide.value === 7) ? styles.cardDanger : (rollNum <= 3 && diceSide.value === 7 ? styles.cardGreen : styles.card)} onClick={() => clickNumber(diceSide.value)}>
                        <CardContent sx={styles.cardContent}>
                          {diceSide.value}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                  <Grid item xs={4}>
                    <Card sx={rollNum > 3 ? styles.cardGreen : styles.cardGray} onClick={clickDoubles}>
                      <CardContent sx={rollNum <= 3 ? styles.cardContentDoubleDisable : styles.cardContentDouble}>doubles</CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12}>
                    <Card onClick={reset} sx={styles.card}>
                      <CardContent sx={styles.cardContent}>Reset</CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Grid>

              {/* Right */}
              <Grid item md={8}>
                <Typography sx={{ textAlign: "right", fontSize: "2rem" }}>Round: {roundNum}/20</Typography>
                <Typography
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    textAlign: "center",
                    fontSize: "8rem",
                    fontWeight: 700
                  }}
                >
                  {roundTotal}
                </Typography>
                {/* ?
                <PlayerCard player={arrPlayers[0]} />
                :
                <></>
                } */}
              </Grid>
            </Grid>
          </Box>
        </>
        :
        <MobileLanding handleSetMobile={setIsMobile} />
      }
    </>

  );
};

export default Desktop;
