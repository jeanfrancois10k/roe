import { Test, TestingModule } from '@nestjs/testing';
import { DrawsService } from '../src/modules/draws/draws.service';
import { DrawEvaluatorService } from '../src/modules/draws/draw-evaluator.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { RealtimeGateway } from '../src/modules/realtime/realtime.gateway';
import { ConfigService } from '@nestjs/config';
import { DrawStatus, TicketStatus, TicketPayoutStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Phase 7: Tirages, Résultats & Évaluation des Gains', () => {
  describe('DrawEvaluatorService (Moteur de Règles Loterie)', () => {
    let evaluator: DrawEvaluatorService;

    beforeEach(() => {
      evaluator = new DrawEvaluatorService();
    });

    const winningResults = {
      firstPrize: '512', // Borlette: 12, Lot 3: 512
      secondPrize: '34',
      thirdPrize: '78',
    };

    it('doit identifier et calculer un gain au 1er Lot Borlette (50x)', () => {
      const grids = [{ numbers: ['12'], betAmount: 10 }];
      const res = evaluator.evaluateTicket(grids, winningResults);

      expect(res.isWinner).toBe(true);
      expect(res.totalWonAmount).toBe(500); // 10 * 50
      expect(res.gridEvaluations[0].winningDescription).toContain('1er Lot Gagnant (12)');
    });

    it('doit identifier et calculer un gain au 2e Lot Borlette (20x)', () => {
      const grids = [{ numbers: ['34'], betAmount: 5 }];
      const res = evaluator.evaluateTicket(grids, winningResults);

      expect(res.isWinner).toBe(true);
      expect(res.totalWonAmount).toBe(100); // 5 * 20
      expect(res.gridEvaluations[0].winningDescription).toContain('2e Lot Gagnant (34)');
    });

    it('doit identifier et calculer un gain au 3e Lot Borlette (10x)', () => {
      const grids = [{ numbers: ['78'], betAmount: 5 }];
      const res = evaluator.evaluateTicket(grids, winningResults);

      expect(res.isWinner).toBe(true);
      expect(res.totalWonAmount).toBe(50); // 5 * 10
      expect(res.gridEvaluations[0].winningDescription).toContain('3e Lot Gagnant (78)');
    });

    it('doit identifier un Mariage Gagnant (1000x)', () => {
      // 12 et 78 sont tous deux parmi les lots gagnants (1er et 3e lot)
      const grids = [{ numbers: ['12', '78'], betAmount: 2 }];
      const res = evaluator.evaluateTicket(grids, winningResults);

      expect(res.isWinner).toBe(true);
      expect(res.totalWonAmount).toBe(2000); // 2 * 1000
      expect(res.gridEvaluations[0].winningDescription).toContain('Mariage Gagnant');
    });

    it('doit évaluer les options de Mariage (Op 1, Op 2, Op 3) et Maryaj Gratis', () => {
      // 1er lot = 12, 2e lot = 34, 3e lot = 78
      const grids = [
        { numbers: ['12', '34'], betAmount: 5, option: 'OP1' }, // Gagnant Op 1 (1e-2e)
        { numbers: ['12', '78'], betAmount: 5, option: 'OP2' }, // Gagnant Op 2 (1e-3e)
        { numbers: ['34', '78'], betAmount: 5, option: 'OP3' }, // Gagnant Op 3 (2e-3e)
        { numbers: ['12x34'], betAmount: 0, isGratis: true, gameType: 'MARIAGE' }, // Maryaj Gratis
      ];
      const res = evaluator.evaluateTicket(grids, winningResults);

      expect(res.isWinner).toBe(true);
      expect(res.gridEvaluations[0].isWinningGrid).toBe(true);
      expect(res.gridEvaluations[0].winningDescription).toContain('Op 1');
      expect(res.gridEvaluations[1].isWinningGrid).toBe(true);
      expect(res.gridEvaluations[1].winningDescription).toContain('Op 2');
      expect(res.gridEvaluations[2].isWinningGrid).toBe(true);
      expect(res.gridEvaluations[2].winningDescription).toContain('Op 3');
      expect(res.gridEvaluations[3].isWinningGrid).toBe(true);
      expect(res.gridEvaluations[3].winningDescription).toContain('Gratis');
    });

    it('doit évaluer les options de Lòt 4 (Op 1, Op 2, Op 3, Tout)', () => {
      // 1er lot = 12, 2e lot = 34, 3e lot = 78
      // Op 1 = 1234, Op 2 = 1278, Op 3 = 3478
      const grids = [
        { numbers: ['1234'], betAmount: 2, option: 'OP1' },
        { numbers: ['1278'], betAmount: 2, option: 'OP2' },
        { numbers: ['3478'], betAmount: 2, option: 'OP3' },
        { numbers: ['1234'], betAmount: 2, option: 'TOUT' },
      ];
      const res = evaluator.evaluateTicket(grids, winningResults);

      expect(res.isWinner).toBe(true);
      expect(res.gridEvaluations[0].isWinningGrid).toBe(true);
      expect(res.gridEvaluations[0].wonAmount).toBe(10000); // 2 * 5000
      expect(res.gridEvaluations[1].isWinningGrid).toBe(true);
      expect(res.gridEvaluations[2].isWinningGrid).toBe(true);
      expect(res.gridEvaluations[3].isWinningGrid).toBe(true);
    });

    it('doit identifier un Lòt 3 Gagnant (500x)', () => {
      const grids = [{ numbers: ['512'], betAmount: 5 }];
      const res = evaluator.evaluateTicket(grids, winningResults);

      expect(res.isWinner).toBe(true);
      expect(res.totalWonAmount).toBe(2500); // 5 * 500
      expect(res.gridEvaluations[0].winningDescription).toContain('Lòt 3 Gagnant (512)');
    });

    it('doit renvoyer isWinner = false si aucun numéro ne gagne', () => {
      const grids = [
        { numbers: ['99'], betAmount: 10 },
        { numbers: ['00', '11'], betAmount: 5 },
      ];
      const res = evaluator.evaluateTicket(grids, winningResults);

      expect(res.isWinner).toBe(false);
      expect(res.totalWonAmount).toBe(0);
      expect(res.gridEvaluations[0].isWinningGrid).toBe(false);
      expect(res.gridEvaluations[1].isWinningGrid).toBe(false);
    });
  });

  describe('DrawsService (Cycle de Vie, Validation Cryptographique & Évaluation Batch)', () => {
    let drawsService: DrawsService;
    let prismaMock: any;
    let auditMock: any;
    let realtimeMock: any;

    beforeEach(async () => {
      prismaMock = {
        draw: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        ticket: {
          findMany: jest.fn(),
          update: jest.fn(),
          count: jest.fn(),
        },
      };

      auditMock = {
        log: jest.fn().mockResolvedValue(true),
      };

      realtimeMock = {
        server: {
          emit: jest.fn(),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrawsService,
          DrawEvaluatorService,
          { provide: PrismaService, useValue: prismaMock },
          { provide: AuditService, useValue: auditMock },
          { provide: RealtimeGateway, useValue: realtimeMock },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => 'test_draw_secret_key_12345'),
            },
          },
        ],
      }).compile();

      drawsService = module.get<DrawsService>(DrawsService);
    });

    it('doit publier le tirage, sceller le hash SHA-256 et évaluer automatiquement les tickets', async () => {
      const mockDraw = {
        id: 'draw-1',
        drawNumber: 101,
        status: DrawStatus.DRAWN,
        winningResults: { firstPrize: '512', secondPrize: '34', thirdPrize: '78' },
        game: {
          code: 'BOLET_NY',
          name: 'Bolet New York',
          gameRules: {
            multipliers: { firstPrize: 50, secondPrize: 20, thirdPrize: 10, mariage: 1000, lot3: 500 },
          },
        },
      };

      prismaMock.draw.findUnique.mockResolvedValue(mockDraw);
      prismaMock.draw.update.mockResolvedValue({
        ...mockDraw,
        status: DrawStatus.PUBLISHED,
        publishedAt: new Date(),
        validationHash: 'signed_sha256_hash_abc',
      });

      // 2 tickets : l'un gagnant (12) et l'autre perdant (99)
      const mockTickets = [
        {
          id: 'ticket-winner',
          ticketNumber: 'ROE-2026-WIN1',
          playedGrids: [{ numbers: ['12'], betAmount: 10 }],
        },
        {
          id: 'ticket-loser',
          ticketNumber: 'ROE-2026-LOSE1',
          playedGrids: [{ numbers: ['99'], betAmount: 5 }],
        },
      ];

      prismaMock.ticket.findMany.mockResolvedValue(mockTickets);
      prismaMock.ticket.update.mockResolvedValue({});

      const result = await drawsService.publishDraw('draw-1', 'admin-id-1');

      expect(prismaMock.draw.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DrawStatus.PUBLISHED,
            validationHash: expect.any(String),
          }),
        }),
      );

      // Le ticket gagnant doit avoir wonAmount = 500 et isWinner = true
      expect(prismaMock.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-winner' },
        data: {
          isWinner: true,
          wonAmount: 500,
          payoutStatus: TicketPayoutStatus.UNPAID,
        },
      });

      // Le ticket perdant doit avoir wonAmount = 0 et isWinner = false
      expect(prismaMock.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-loser' },
        data: {
          isWinner: false,
          wonAmount: 0,
          payoutStatus: TicketPayoutStatus.UNPAID,
        },
      });

      // Émission WebSocket instantanée
      expect(realtimeMock.server.emit).toHaveBeenCalledWith(
        'draw:results_published',
        expect.objectContaining({
          drawId: 'draw-1',
          drawNumber: 101,
          totalWinners: 1,
          totalWonAmount: 500,
        }),
      );

      // Audit scellé
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DRAW_RESULTS_PUBLISHED',
          userId: 'admin-id-1',
        }),
      );

      expect(result.evaluationSummary.totalWinners).toBe(1);
      expect(result.evaluationSummary.totalWonAmount).toBe(500);
    });

    it('doit empêcher la saisie normale des résultats sur un tirage déjà publié', async () => {
      prismaMock.draw.findUnique.mockResolvedValue({
        id: 'draw-already-pub',
        status: DrawStatus.PUBLISHED,
      });

      await expect(
        drawsService.setResults(
          'draw-already-pub',
          {
            winningResults: { firstPrize: '111', secondPrize: '22', thirdPrize: '33' },
          },
          'admin-id-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('doit permettre une rectification exceptionnelle tracée (overrideResults)', async () => {
      const mockDraw = {
        id: 'draw-to-override',
        drawNumber: 105,
        status: DrawStatus.PUBLISHED,
        winningResults: { firstPrize: '100', secondPrize: '20', thirdPrize: '30' },
        validationHash: 'old_hash',
        game: { code: 'BOLET_NY', gameRules: {} },
      };

      prismaMock.draw.findUnique.mockResolvedValue(mockDraw);
      prismaMock.ticket.count.mockResolvedValue(0); // Aucun ticket encore payé
      prismaMock.draw.update.mockResolvedValue({
        ...mockDraw,
        winningResults: { firstPrize: '512', secondPrize: '34', thirdPrize: '78' },
      });
      prismaMock.ticket.findMany.mockResolvedValue([]);

      const overrideRes = await drawsService.overrideResults(
        'draw-to-override',
        {
          winningResults: { firstPrize: '512', secondPrize: '34', thirdPrize: '78' },
          justificationReason: 'Erreur de saisie constatée par le superviseur',
        },
        'superadmin-1',
      );

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DRAW_RESULTS_OVERRIDDEN',
          userId: 'superadmin-1',
          newPayload: expect.objectContaining({
            justificationReason: 'Erreur de saisie constatée par le superviseur',
          }),
        }),
      );

      expect(realtimeMock.server.emit).toHaveBeenCalledWith(
        'draw:results_overridden',
        expect.objectContaining({
          drawNumber: 105,
          justificationReason: 'Erreur de saisie constatée par le superviseur',
        }),
      );
    });
  });
});
