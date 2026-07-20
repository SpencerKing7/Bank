import React from 'react';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Box, IconButton, Typography } from '@mui/material';
import { PlayerDoc } from '../game/types';
import { ROW_GAP, ROW_HEIGHT, usePlayerDrag } from '../hooks/usePlayerDrag';
import { DISPLAY_FONT } from '../theme';

interface PlayerOrderListProps {
  players: PlayerDoc[]; // already in seat order
  uid: string;
  hostId: string;
  // Host, in the lobby. Everyone else gets the same list read-only — seat order
  // is the roll order now, so players need to see it even when they can't
  // change it.
  canManage: boolean;
  onReorder: (orderedIds: string[]) => void;
  onRemove: (player: PlayerDoc) => void;
}

export default function PlayerOrderList({
  players,
  uid,
  hostId,
  canManage,
  onReorder,
  onRemove,
}: PlayerOrderListProps) {
  const ids = players.map((p) => p.id);
  const drag = usePlayerDrag(ids, onReorder);

  // Keyboard equivalent of a drag. The handle is focusable and moves its row a
  // seat at a time — ListMaster's handle is a bare div with no keyboard path at
  // all, which is the one part of it not worth copying.
  const moveBy = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    onReorder(next);
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {players.map((player, index) => {
        const isDragging = drag.state?.id === player.id;
        const offset = drag.offsetFor(player.id);
        const isMe = player.id === uid;
        const isHostRow = player.id === hostId;
        return (
          <Box
            key={player.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              height: ROW_HEIGHT,
              mb: `${ROW_GAP}px`,
              px: 1.5,
              borderRadius: '14px',
              border: '1px solid',
              borderColor: isMe ? 'primary.main' : 'divider',
              bgcolor: isMe ? 'rgba(43, 224, 128, 0.12)' : 'background.paper',
              position: 'relative',
              zIndex: isDragging ? 10 : 1,
              transform: `translateY(${offset}px)`,
              // Asymmetric on purpose: the dragged row must track the finger
              // with zero lag, so only its siblings get a transform transition.
              transition: isDragging
                ? 'box-shadow 120ms ease'
                : 'transform 180ms cubic-bezier(0.2, 0, 0, 1)',
              boxShadow: isDragging ? '0 6px 20px rgba(0, 0, 0, 0.45)' : 'none',
              scale: isDragging ? '1.02' : '1',
            }}
          >
            <Typography
              sx={{
                fontFamily: DISPLAY_FONT,
                fontSize: '1.25rem',
                color: 'text.secondary',
                minWidth: 20,
              }}
            >
              {index + 1}
            </Typography>

            {canManage && (
              <Box
                role="button"
                tabIndex={0}
                aria-label={`Reorder ${player.name}, seat ${index + 1} of ${players.length}. Use arrow keys to move.`}
                onPointerDown={(e) => drag.startDrag(e, player.id)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    moveBy(index, -1);
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    moveBy(index, 1);
                  }
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  // Scoped to the handle so the list itself still scrolls.
                  touchAction: 'none',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  color: 'text.disabled',
                  p: 1,
                  m: -1, // bigger thumb target without changing the layout
                  borderRadius: '8px',
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                }}
              >
                <DragIndicatorIcon sx={{ pointerEvents: 'none' }} />
              </Box>
            )}

            <Typography sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0 }} noWrap>
              {player.name}
              {isHostRow && (
                <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                  {' · host'}
                </Box>
              )}
            </Typography>

            {canManage && !isHostRow && (
              <IconButton
                aria-label={`Remove ${player.name}`}
                onClick={() => onRemove(player)}
                sx={{ color: 'text.disabled', '&:hover': { color: 'error.light' } }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
