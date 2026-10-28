import { Injectable, Logger } from '@nestjs/common';
import { WinningResultsDto } from './dto/set-results.dto';

export interface GridEvaluation {
  numbers: string[];
  betAmount: number;
  isWinningGrid: boolean;
  wonAmount: number;
  winningDescription: string | null;
}

export interface TicketEvaluationResult {
  isWinner: boolean;
  totalWonAmount: number;
  gridEvaluations: GridEvaluation[];
}

@Injectable()
export class DrawEvaluatorService {
  private readonly logger = new Logger(DrawEvaluatorService.name);

  /**
   * Évalue les grilles d'un ticket contre les numéros officiels d'un tirage
   */
  evaluateTicket(
    grids: Array<{ numbers: string[]; betAmount: number | string }>,
    winningResults: WinningResultsDto,
    gameRulesJson?: any,
  ): TicketEvaluationResult {
    const rules = gameRulesJson || {};
    const multipliers = {
      firstPrize: rules.multipliers?.firstPrize ?? rules.borlette?.firstPrizeMultiplier ?? 50,
      secondPrize: rules.multipliers?.secondPrize ?? rules.borlette?.secondPrizeMultiplier ?? 20,
      thirdPrize: rules.multipliers?.thirdPrize ?? rules.borlette?.thirdPrizeMultiplier ?? 10,
      mariage: rules.multipliers?.mariage ?? rules.mariage?.multiplier ?? 1000,
      mariageGratis: rules.mariageGratisPayout ?? rules.multipliers?.mariageGratis ?? rules.mariage?.mariageGratis ?? 1500,
      lot3: rules.multipliers?.lot3 ?? rules.lot3?.multiplier ?? 500,
      lot4: rules.multipliers?.lot4 ?? rules.lot4?.multiplier ?? 5000,
      lot5: rules.multipliers?.lot5 ?? rules.lot5?.multiplier ?? 25000,
    };


    // Normalisation des tirages officiels
    const rawFirst = String(winningResults.firstPrize).trim();
    const rawSecond = String(winningResults.secondPrize).trim();
    const rawThird = String(winningResults.thirdPrize).trim();

    // 2 derniers chiffres pour la Borlette traditionnelle
    const firstLot2 = rawFirst.slice(-2).padStart(2, '0');
    const secondLot2 = rawSecond.slice(-2).padStart(2, '0');
    const thirdLot2 = rawThird.slice(-2).padStart(2, '0');

    // Chiffres complets pour Lòt 3 (3 chiffres obligatoires, ex: "040")
    const firstLot3 = rawFirst.length >= 3 ? rawFirst.slice(-3) : (rawFirst ? rawFirst.padStart(3, '0') : null);
    const winningPairs = [firstLot2, secondLot2, thirdLot2];

    let totalWon = 0;
    const gridEvaluations: GridEvaluation[] = [];

    for (const grid of grids) {
      const betAmount = Number(grid.betAmount);
      const cleanNumbers = (grid.numbers || []).map((n) => String(n).trim());
      let gridWon = 0;
      let description: string | null = null;

      const gridAny = grid as any;
      const option = gridAny.option ? String(gridAny.option).trim().toUpperCase().replace(/\s+/g, '') : 'TOUT';
      const gameType = gridAny.gameType ? String(gridAny.gameType).trim().toUpperCase() : null;
      const isGratis = gridAny.isGratis === true || option === 'GRATIS' || (gameType === 'MARIAGE' && betAmount === 0);

      // Détection des paires Maryaj (soit 2 numéros si pas BORLETTE, soit 1 chaîne avec séparateur ex: "12x34" ou 4 chiffres si gameType MARIAGE)
      let maryajPair: [string, string] | null = null;
      if (cleanNumbers.length === 2 && gameType !== 'BORLETTE' && gameType !== 'BOLET') {
        maryajPair = [cleanNumbers[0].padStart(2, '0'), cleanNumbers[1].padStart(2, '0')];
      } else if (cleanNumbers.length === 1) {
        const parts = cleanNumbers[0].split(/[x\-\*\s\/]+/).filter(Boolean);
        if (parts.length === 2) {
          maryajPair = [parts[0].padStart(2, '0'), parts[1].padStart(2, '0')];
        } else if (cleanNumbers[0].length === 4 && (gameType === 'MARIAGE' || gameType === 'MARYAJ')) {
          maryajPair = [cleanNumbers[0].slice(0, 2).padStart(2, '0'), cleanNumbers[0].slice(2, 4).padStart(2, '0')];
        }
      }

      // 1. Borlette traditionnelle (1 ou plusieurs numéros de 1 ou 2 chiffres, ex: ["50"] ou ["50", "05"])
      // Règle Haïtienne Dekabè / Dekole : Si un numéro joué apparaît dans plusieurs lots du tirage (ex: 2e et 3e lot),
      // le joueur gagne pour CHAQUE lot où il apparaît (ex: 20x + 10x = 30x).
      const isBorlette = (gameType === 'BORLETTE' || gameType === 'BOLET') ||
                         (cleanNumbers.length === 1 && cleanNumbers[0].length <= 2 && !maryajPair);

      if (isBorlette && !maryajPair) {
        const playedNumbers = cleanNumbers.filter((n) => n.length <= 2).map((n) => n.padStart(2, '0'));
        let totalMultForGrid = 0;
        const allMatchesDesc: string[] = [];

        for (const playedNum of playedNumbers) {
          const matches: Array<{ lotName: string; lotNum: string; mult: number }> = [];

          if (playedNum === firstLot2) {
            matches.push({ lotName: '1er Lot', lotNum: firstLot2, mult: multipliers.firstPrize ?? 50 });
          }
          if (playedNum === secondLot2) {
            matches.push({ lotName: '2e Lot', lotNum: secondLot2, mult: multipliers.secondPrize ?? 20 });
          }
          if (playedNum === thirdLot2) {
            matches.push({ lotName: '3e Lot', lotNum: thirdLot2, mult: multipliers.thirdPrize ?? 10 });
          }

          if (matches.length > 0) {
            const totalNumMult = matches.reduce((sum, m) => sum + m.mult, 0);
            totalMultForGrid += totalNumMult;

            if (matches.length === 1) {
              allMatchesDesc.push(`${matches[0].lotName} Gagnant (${matches[0].lotNum}) - ${matches[0].mult}x`);
            } else {
              // Dekabè : numéro répété dans plusieurs lots
              const partsDesc = matches.map((m) => `${m.lotName} (${m.lotNum}) ${m.mult}x`).join(' + ');
              allMatchesDesc.push(`${partsDesc} [Dekabè] - ${totalNumMult}x`);
            }
          }
        }

        if (totalMultForGrid > 0) {
          gridWon = betAmount * totalMultForGrid;
          description = allMatchesDesc.join(' | ');
        }
      }
      // 2. Lòt 3 / Pick 3 (1 numéro de 3 chiffres, ex: ["512"])
      else if (cleanNumbers.length === 1 && cleanNumbers[0].length === 3 && !maryajPair) {
        const playedNum3 = cleanNumbers[0];
        if (firstLot3 && playedNum3 === firstLot3) {
          const mult = multipliers.lot3 ?? 500;
          gridWon = betAmount * mult;
          description = `Lòt 3 Gagnant (${firstLot3}) - ${mult}x`;
        }
      }
      // 3. Mariage (avec Options 1, 2, 3, Tout & Maryaj Gratis)
      else if (maryajPair) {
        const [numA, numB] = maryajPair;

        if (numA !== numB) {
          let isMaryajWin = false;
          let optionLabel = 'Tout';
          let winMultiplierCount = 1;

          const isOp1 = (numA === firstLot2 && numB === secondLot2) || (numA === secondLot2 && numB === firstLot2);
          const isOp2 = (numA === firstLot2 && numB === thirdLot2) || (numA === thirdLot2 && numB === firstLot2);
          const isOp3 = (numA === secondLot2 && numB === thirdLot2) || (numA === thirdLot2 && numB === secondLot2);

          if (option === 'OP1' || option === 'OPTION1' || option === '1') {
            isMaryajWin = isOp1;
            optionLabel = 'Op 1 (1e-2e)';
          } else if (option === 'OP2' || option === 'OPTION2' || option === '2') {
            isMaryajWin = isOp2;
            optionLabel = 'Op 2 (1e-3e)';
          } else if (option === 'OP3' || option === 'OPTION3' || option === '3') {
            isMaryajWin = isOp3;
            optionLabel = 'Op 3 (2e-3e)';
          } else {
            // Option TOUT ou GRATIS : support du gain combiné si les numéros se répètent dans le tirage
            const matchedOps: string[] = [];
            if (isOp1) matchedOps.push('Op 1');
            if (isOp2) matchedOps.push('Op 2');
            if (isOp3) matchedOps.push('Op 3');

            isMaryajWin = matchedOps.length > 0;
            winMultiplierCount = matchedOps.length > 0 ? matchedOps.length : 1;
            optionLabel = matchedOps.join(' + ');
          }

          if (isMaryajWin) {
            if (isGratis) {
              const baseGratis = multipliers.mariageGratis ?? 1500;
              const gratisWon = baseGratis * winMultiplierCount;
              gridWon = gratisWon;
              description = winMultiplierCount > 1
                ? `Mariage Gratis Gagnant (${numA} × ${numB}) [${optionLabel} Dekabè] - ${gratisWon} G`
                : `Mariage Gratis Gagnant (${numA} × ${numB}) - ${gratisWon} G`;
            } else {
              const baseMult = multipliers.mariage ?? 1000;
              const mult = baseMult * winMultiplierCount;
              gridWon = betAmount * mult;
              description = winMultiplierCount > 1
                ? `Mariage Gagnant (${numA} × ${numB}) [${optionLabel} Dekabè] - ${mult}x`
                : `Mariage Gagnant (${numA} × ${numB}) [${optionLabel}] - ${mult}x`;
            }
          }
        }
      }
      // 4. Lòt 4 / Pick 4 (1 numéro de 4 chiffres, avec Options 1, 2, 3, Tout)
      else if (cleanNumbers.length === 1 && cleanNumbers[0].length === 4) {
        const playedNum4 = cleanNumbers[0];
        const combOp1 = firstLot2 + secondLot2;  // Opsyon 1 : 1er lot + 2e lot
        const combOp2 = firstLot2 + thirdLot2;   // Opsyon 2 : 1er lot + 3e lot
        const combOp3 = secondLot2 + thirdLot2;  // Opsyon 3 : 2e lot + 3e lot

        let isLoto4Win = false;
        let matchedOp = '';

        if (option === 'OP1' || option === 'OPTION1' || option === '1') {
          if (playedNum4 === combOp1) {
            isLoto4Win = true;
            matchedOp = 'Op 1 (1e-2e)';
          }
        } else if (option === 'OP2' || option === 'OPTION2' || option === '2') {
          if (playedNum4 === combOp2) {
            isLoto4Win = true;
            matchedOp = 'Op 2 (1e-3e)';
          }
        } else if (option === 'OP3' || option === 'OPTION3' || option === '3') {
          if (playedNum4 === combOp3) {
            isLoto4Win = true;
            matchedOp = 'Op 3 (2e-3e)';
          }
        } else {
          // Option TOUT : gagne sur l'une des 3 combinaisons
          if (playedNum4 === combOp1) {
            isLoto4Win = true;
            matchedOp = 'Op 1';
          } else if (playedNum4 === combOp2) {
            isLoto4Win = true;
            matchedOp = 'Op 2';
          } else if (playedNum4 === combOp3) {
            isLoto4Win = true;
            matchedOp = 'Op 3';
          }
        }

        if (isLoto4Win) {
          const mult = multipliers.lot4 ?? 5000;
          gridWon = betAmount * mult;
          description = `Lòt 4 Gagnant (${playedNum4}) [${matchedOp}] - ${mult}x`;
        }
      }
      // 5. Lòt 5 (1 numéro de 5 chiffres avec Options 1, 2, 3, Tout)
      else if (cleanNumbers.length === 1 && cleanNumbers[0].length === 5) {
        const playedNum5 = cleanNumbers[0];
        const comb5Op1 = (firstLot3 || '') + (secondLot2 || '');
        const comb5Op2 = (firstLot3 || '') + (thirdLot2 || '');
        const comb5Op3 = (firstLot3 ? firstLot3.substring(0, 1) + (secondLot2 || '') : '') + (thirdLot2 || '');

        let isLoto5Win = false;
        let matchedOp = '';

        if (option === 'OP1' || option === 'OPTION1' || option === '1') {
          if (playedNum5 === comb5Op1) {
            isLoto5Win = true;
            matchedOp = 'Op 1 (1e-2e)';
          }
        } else if (option === 'OP2' || option === 'OPTION2' || option === '2') {
          if (playedNum5 === comb5Op2) {
            isLoto5Win = true;
            matchedOp = 'Op 2 (1e-3e)';
          }
        } else if (option === 'OP3' || option === 'OPTION3' || option === '3') {
          if (playedNum5 === comb5Op3 || playedNum5 === comb5Op1 || playedNum5 === comb5Op2) {
            isLoto5Win = true;
            matchedOp = 'Op 3';
          }
        } else {
          // Option TOUT : gagne sur l'une des combinaisons
          if (playedNum5 === comb5Op1) {
            isLoto5Win = true;
            matchedOp = 'Op 1';
          } else if (playedNum5 === comb5Op2) {
            isLoto5Win = true;
            matchedOp = 'Op 2';
          }
        }

        if (isLoto5Win) {
          const mult = multipliers.lot5 ?? 25000;
          gridWon = betAmount * mult;
          description = `Lòt 5 Gagnant (${playedNum5}) [${matchedOp}] - ${mult}x`;
        }
      }

      const formattedWon = Number(gridWon.toFixed(2));
      totalWon += formattedWon;

      gridEvaluations.push({
        numbers: cleanNumbers,
        betAmount,
        isWinningGrid: formattedWon > 0,
        wonAmount: formattedWon,
        winningDescription: description,
      });
    }

    const roundedTotal = Number(totalWon.toFixed(2));

    return {
      isWinner: roundedTotal > 0,
      totalWonAmount: roundedTotal,
      gridEvaluations,
    };
  }
}
