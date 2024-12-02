import React, { useState } from 'react';
import { Card, CardContent, Grid, Typography, Box } from "@mui/material"
import numbers from '../numbers.json'

export default function Mobile() {
  const [roundTotal, setRoundTotal] = useState(0);
  const [rollNum, setRollNum] = useState(1);
  const [roundNum, setRoundNum] = useState(1);

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
    setRoundTotal(roundTotal * 2);
    setRollNum(rollNum + 1);
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
    }
  };

  return (
    <>
      <Typography sx={{ textAlign: "center", fontWeight: 800, fontSize: "3rem" }}>Bank!</Typography>
      <Box sx={{ p: "2rem" }}>
        {/* Left */}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography sx={{ textAlign: "right" }}>Round: {roundNum}/20</Typography>
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
          </Grid>
        </Grid>

        {/* Right */}
        <Grid item xs={12}>
          <Grid container spacing={3}>
            {numbers.dice.map((diceSide) => (
              <Grid item xs={4} key={diceSide.value}>
                <Card sx={(rollNum > 3 && diceSide.value === 7) ? styles.cardDanger : styles.card} onClick={() => clickNumber(diceSide.value)}>
                  <CardContent sx={styles.cardContent}>
                    {diceSide.value}
                  </CardContent>
                </Card>
              </Grid>
            ))}
            <Grid item xs={4}>
              <Card sx={rollNum > 3 ? styles.cardGreen : styles.card} onClick={clickDoubles}>
                <CardContent sx={styles.cardContent}>doubles</CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card onClick={reset} sx={styles.card}>
                <CardContent sx={styles.cardContent}>Reset</CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </>
  );
};
