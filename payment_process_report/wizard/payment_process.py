from odoo import api, fields, models, _
from datetime import datetime

class PaymentProcess(models.TransientModel):
    _name = 'payment.process'

    invoice_number = fields.Char(string="Invoice Number", readonly=True)
    payment_reason = fields.Char(string="Payment Reason")
    amount = fields.Integer(string="Amount")
    payment_type = fields.Selection([('tt', 'TT'), ('check', 'Check'), ('cash', 'Cash')], string='Payment Type', required=True)
    payee_name = fields.Char(string="Payee Name")
    receiver_name = fields.Char(string="Receiver Name")
    company_bank_name = fields.Char(string="Company bank name")
    client_bank_name = fields.Char(string="Client Bank name")
    date_of_tt = fields.Date(string="Date of TT")
    check_bank_name = fields.Char(string="Check bank name")
    check_no = fields.Char(string="Check No")
    check_date = fields.Date(string="Check Date")
    city_name = fields.Char(string="City Name")


    @api.model
    def default_get(self, fields):
        rec = super(PaymentProcess, self).default_get(fields)
        active_id = self._context['active_id']
        current_record = self.env["account.payment"].browse(self._context['active_id'])
        rec.update({'invoice_number': current_record.communication,})
        return rec

    @api.multi
    def submit_payment(self):
        self.ensure_one()
        print "self checkdate====>>>>",self.check_date
        print "self date_of_tt====>>>>",self.date_of_tt
        current_record = self.env["account.payment"].browse(self._context['active_id'])
        rec = {#'invoice_number': self.invoice_number,
               'payment_reason': self.payment_reason,
               'payment_amount': self.amount,
               'payment_process_type': self.payment_type,
               'payee_name': self.payee_name or False,
               'receiver_name': self.receiver_name or False,
               'company_bank_name': self.company_bank_name or False,
               'client_bank_name': self.client_bank_name or False,
               'date_of_tt': self.date_of_tt or False,
               'check_bank_name': self.check_bank_name or False,
               'check_no': self.check_no or False,
               'check_date': self.check_date or False,
               'city_name': self.city_name or False,
               }
        print "rec====>>>>",rec
        current_record.write(rec)
        data = {}
        data['ids'] = self.env.context.get('active_ids', [])
        data['model'] = self.env.context.get('active_model', 'ir.ui.menu')
        data['form'] = self.read(['invoice_number', 'payment_reason', 'amount', 'payment_type', 'payee_name', 'receiver_name', 'company_bank_name', 'client_bank_name', 'date_of_tt', 'check_bank_name', 'check_no', 'check_date', 'city_name'])[0]
        print"data['form']===>>>",data['form']
        print "\n\n\n\n submit_payment===>>> ",data
        return self.env['report'].get_action(self, 'payment_process_report.payment_process_report_tmp_id', data=data)

class account_payment_inherit(models.Model):
    _inherit = 'account.payment'

    payment_reason = fields.Char(string="Payment Reason", readonly=True)
    payment_amount = fields.Integer(string="Amount", readonly=True)
    payment_process_type = fields.Selection([('tt', 'TT'), ('check', 'Check'), ('cash', 'Cash')], string='Payment Type', readonly=True)
    payee_name = fields.Char(string="Payee Name", readonly=True)
    receiver_name = fields.Char(string="Receiver Name", readonly=True)
    company_bank_name = fields.Char(string="Company bank name", readonly=True)
    client_bank_name = fields.Char(string="Client Bank name", readonly=True)
    date_of_tt = fields.Date(string="Date of TT", readonly=True)
    check_bank_name = fields.Char(string="Check bank name", readonly=True)
    check_no = fields.Char(string="Check No", readonly=True)
    check_date = fields.Date(string="Check Date", readonly=True)
    city_name = fields.Char(string="City Name", readonly=True)

    @api.multi
    def payment_receipt_process(self):
        ir_model_data = self.env['ir.model.data']
        try:
            compose_form_id = ir_model_data.get_object_reference('payment_process_report', 'multiple_payment_register_form')[1]
            print"compose_form_id with out [1]====>>",compose_form_id #(u'ir.ui.view', 2404)
            print"compose_form_id with [1]====>>",compose_form_id#compose_form_id with [1]====>> 2404
        except ValueError:
            compose_form_id = False
        res = {
            'type': 'ir.actions.act_window',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'payment.process',
            'views': [(compose_form_id, 'form')],
            'view_id': compose_form_id,
            'target': 'new',
            'context': {'default_name': self.id}
        }
        print"=========context=====>>>", res['context'],"\n\n\n"
        return res



