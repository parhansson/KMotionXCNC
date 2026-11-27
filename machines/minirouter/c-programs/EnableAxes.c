#include "KMotionDef.h"

// EnableAxis() enables at the encoder position. An axis with no encoder (open loop step/dir)
// has no valid position, so Dest would jump to a stale value. Enable those where they are
void EnableInPlace(int ch)
{
  if (chan[ch].InputMode == NO_INPUT_MODE)
    EnableAxisDest(ch, chan[ch].Dest);
  else
    EnableAxis(ch);
}

main()
{

  EnableInPlace(0);
  EnableInPlace(1);
  EnableInPlace(2);

//  DefineCoordSystem(0,1,2,-1);

  printf("Axes enabled\n");

  return;

}
