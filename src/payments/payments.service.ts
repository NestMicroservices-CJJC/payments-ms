import { Inject, Injectable, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { envs, NATS_SERVICE } from 'src/config';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecret);
  private readonly logger = new Logger('PaymentService');

  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {
    const { currency, items, orderId } = paymentSessionDto;

    const lineItems = items.map((item) => {
      return {
        price_data: {
          currency: currency,
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      };
    });

    const session = await this.stripe.checkout.sessions.create({
      //* colocar aquí el ID de la orden
      payment_intent_data: {
        metadata: {
          orderId: orderId,
        },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: envs.stripeSuccessUrl,
      cancel_url: envs.stripeCancelUrl,
    });
    // return session;
    return {
      cancelUrl: session.cancel_url,
      successlUrl: session.success_url,
      url: session.url,
    };
  }

  async stripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'];
    // console.log({ sig });

    let event: Stripe.Event;

    //* End Point Testing
    // const endpointSecret = 'whsec_8b8e1305b71cbe45e0f5acfaf4627f009167fb38c5fae5a02e490ae25a100e54';

    //* End Point Real
    const endpointSecret = envs.stripeEndpointSecret;

    try {
      event = this.stripe.webhooks.constructEvent(req['rawBody'], sig, endpointSecret);
    } catch (error) {
      res.status(400).send(`Webhook Error: ${error.message}`);
      return;
    }

    // console.log({ EVENTS: { event } });
    switch (event.type) {
      case 'charge.succeeded':
        const chargeSucceeded = event.data.object;
        // console.log({
        //   metadata: chargeSucceeded.metadata,
        // });
        // console.log({ metadata: chargeSucceeded.metadata, ...event });
        // console.log({
        //   metadata: chargeSucceeded.metadata,
        //   orderId: chargeSucceeded.metadata.orderId,
        //   receipt_url: chargeSucceeded.receipt_url,
        // });

        const payload = {
          stripePaymentId: chargeSucceeded.id,
          orderId: chargeSucceeded.metadata.orderId,
          receiptUrl: chargeSucceeded.receipt_url,
        };

        // this.logger.log({ payload });

        this.client.emit({ cmd: 'payment.succeeded' }, payload);

        break;
      default:
        console.log(`Event ${event.type} not handled`);
    }
    return res.status(200).json({ sig });
  }
}

/*       line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'T-Shirt',
            },
            unit_amount: currency,
          },
          quantity: 2,
        },
      ], */

/**
  {
    "statusCode": 400,
    "message": "Invalid currency: $. Stripe currently supports these currencies: 
    usd, aed, afn, all, amd, ang, aoa, ars, aud, awg, azn, bam, bbd, bdt, bgn, 
    bhd, bif, bmd, bnd, bob, brl, bsd, bwp, byn, bzd, cad, cdf, chf, clp, cny, 
    cop, crc, cve, czk, djf, dkk, dop, dzd, egp, etb, eur, fjd, fkp, gbp, gel, 
    gip, gmd, gnf, gtq, gyd, hkd, hnl, hrk, htg, huf, idr, ils, inr, isk, jmd, 
    jod, jpy, kes, kgs, khr, kmf, krw, kwd, kyd, kzt, lak, lbp, lkr, lrd, lsl,
     mad, mdl, mga, mkd, mmk, mnt, mop, mur, mvr, mwk, mxn, myr, mzn, nad, ngn, 
     nio, nok, npr, nzd, omr, pab, pen, pgk, php, pkr, pln, pyg, qar, ron, rsd, rub
     , rwf, sar, sbd, scr, sek, sgd, shp, sle, sos, srd, std, szl, thb, tjs, tnd, 
     top, try, ttd, twd, tzs, uah, ugx, uyu, uzs, vnd, vuv, wst, xaf, xcd, xof, xpf, 
     yer, zar, zmw, usdc, btn, ghs, eek, lvl, svc, vef, ltl, sll, mro"
}
       */
