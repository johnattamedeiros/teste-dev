import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('ZipcodeController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /zipcode/:zipcode', () => {
    it('should return 400 for invalid zipcode format', () => {
      return request(app.getHttpServer())
        .get('/zipcode/invalid')
        .expect(400);
    });

    it('should accept valid zipcode format with hyphen', () => {
      return request(app.getHttpServer())
        .get('/zipcode/01310-100')
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('zipcode');
          expect(response.body).toHaveProperty('state');
          expect(response.body).toHaveProperty('city');
        });
    });

    it('should accept valid zipcode format without hyphen', () => {
      return request(app.getHttpServer())
        .get('/zipcode/01310100')
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('zipcode');
          expect(response.body).toHaveProperty('state');
          expect(response.body).toHaveProperty('city');
        });
    });

    it('should support language query parameter', () => {
      return request(app.getHttpServer())
        .get('/zipcode/01310-100?lang=en')
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('zipcode');
          expect(response.body).toHaveProperty('state');
          expect(response.body).toHaveProperty('city');
        });
    });
  });
});
