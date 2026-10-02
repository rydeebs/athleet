import {createPaymentService} from '../server/payments.mjs';
export default {fetch(request){return createPaymentService(process.env).webhook(request);}};
