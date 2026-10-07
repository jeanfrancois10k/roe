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
    const multipliers = rules.multipliers || {
      firstPrize: 50,
      secondPrize: 20,
      thirdPrize: 10,
      mariage: 1000,
      lot3: 500,
      lot4: 5000,
    };

    // Normalisation des tirages officiels
    const rawFirst = String(winningResults.firstPrize).trim();
    const rawSecond = String(winningResults.secondPrize).trim();
    const rawThird = String(winningResults.thirdPrize).trim();

    // 2 derniers chiffres pour la Borlette traditionnelle
    const firstLot2 = rawFirst.slice(-2).padStart(2, '0');
    const secondLot2 = rawSecond.slice(-2).padStart(2, '0');
    const thirdLot2 = rawThird.slice(-2).padStart(2, '0');

    // Chiffres complets pour Lòt 3 / Lòt 4
    const firstLot3 = rawFirst.length >= 3 ? rawFirst.slice(-3) : null;
    const winningPairs = [firstLot2, secondLot2, thirdLot2];

    let totalWon = 0;
    const gridEvaluations: GridEvaluation[] = [];

    for (const grid of grids) {
      const betAmount = Number(grid.betAmount);
      const cleanNumbers = (grid.numbers || []).map((n) => String(n).trim());
      let gridWon = 0;
      let description: string | null = null;

      // 1. Borlette simple (1 numéro de 1 ou 2 chiffres, ex: ["12"] ou ["7"])
      if (cleanNumbers.length === 1 && cleanNumbers[0].length <= 2) {
        const playedNum = cleanNumbers[0].padStart(2, '0');

        if (playedNum === firstLot2) {
          const mult = multipliers.firstPrize ?? 50;
          gridWon = betAmount * mult;
          description = `1er Lot Gagnant (${firstLot2}) - ${mult}x`;
        } else if (playedNum === secondLot2) {
          const mult = multipliers.secondPrize ?? 20;
          gridWon = betAmount * mult;
          description = `2e Lot Gagnant (${secondLot2}) - ${mult}x`;
        } else if (playedNum === thirdLot2) {
          const mult = multipliers.thirdPrize ?? 10;
          gridWon = betAmount * mult;
          description = `3e Lot Gagnant (${thirdLot2}) - ${mult}x`;
        }
      }
      // 2. Lòt 3 / Pick 3 (1 numéro de 3 chiffres, ex: ["512"])
      else if (cleanNumbers.length === 1 && cleanNumbers[0].length === 3) {
        const playedNum3 = cleanNumbers[0];
        if (firstLot3 && playedNum3 === firstLot3) {
          const mult = multipliers.lot3 ?? 500;
          gridWon = betAmount * mult;
          description = `Lòt 3 Gagnant (${firstLot3}) - ${mult}x`;
        }
      }
      // 3. Mariage (2 numéros de 2 chiffres, ex: ["12", "34"])
      else if (cleanNumbers.length === 2) {
        const numA = cleanNumbers[0].padStart(2, '0');
        const numB = cleanNumbers[1].padStart(2, '0');

        // Les deux numéros doivent être distincts et figurer parmi les 3 lots
        const matchA = winningPairs.includes(numA);
        const matchB = winningPairs.includes(numB);

        if (numA !== numB && matchA && matchB) {
          const mult = multipliers.mariage ?? 1000;
          gridWon = betAmount * mult;
          description = `Mariage Gagnant (${numA} × ${numB}) - ${mult}x`;
        }
      }
      // 4. Lòt 4 / Pick 4 (1 numéro de 4 chiffres)
      else if (cleanNumbers.length === 1 && cleanNumbers[0].length === 4) {
        const playedNum4 = cleanNumbers[0];
        const combined23 = secondLot2 + thirdLot2; // Traditionnellement 2e + 3e lot

        if (playedNum4 === combined23) {
          const mult = multipliers.lot4 ?? 5000;
          gridWon = betAmount * mult;
          description = `Lòt 4 Gagnant (${playedNum4}) - ${mult}x`;
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
