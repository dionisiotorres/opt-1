import time
from odoo import api, models, _
from odoo.exceptions import UserError
from datetime import datetime


class PaymentProcessReport(models.AbstractModel):
    _name = 'report.payment_process_report.payment_process_report_tmp_id'

    def get_payment_details(self, data):
        lines = []
        account_payment_record = self.env['account.payment'].search([('communication', '=', data['invoice_number'])])
        #child_reports = account_report._get_children_by_order()
        vals = {}
        vals = {'invoice_no': account_payment_record.communication,
		                'total_amount': account_payment_record.payment_date,
		                'payment_date': account_payment_record.payment_date,
		                'amount': data['amount'],
		                'payment_reason': data['payment_reason'],
		                'client_name': account_payment_record.partner_id.name,}
        if data['payment_type'] == 'cash':
			vals.update({'payee_name': data['payee_name'],'receiver_name': data['receiver_name'],})
        if data['payment_type'] == 'check':
			vals.update({'check_bank_name': data['check_bank_name'],'check_no': data['check_no'], 'check_date': data['check_date'], 'city_name': data['city_name'],})
        if data['payment_type'] == 'tt':
			vals.update({'company_bank_name': data['company_bank_name'],'client_bank_name': data['client_bank_name'], 'date_of_tt': data['date_of_tt'],})
        lines.append(vals)
        print "lines====>>>>",lines
        return lines

    @api.model
    def render_html(self, docids, data=None):
        print "\n\n render_html"
        if not data.get('form') or not self.env.context.get('active_model') or not self.env.context.get('active_id'):
            raise UserError(_("Form content is missing, this report cannot be printed."))

        #self.model = self.env.context.get('active_model')
        self.model = self._context['active_model']
        docs = self.env[self.model].browse(self.env.context.get('active_id'))
        print "\n\n\n docs",docs
        report_lines = self.get_payment_details(data.get('form'))
        docargs = {
            'doc_ids': self.ids,
            'doc_model': self.model,
            'data': data['form'],
            'docs': docs,
            'time': time,
            'get_payment_lines': report_lines,
        }
        print "docargs====>>>>",docargs
        return self.env['report'].render('payment_process_report.payment_process_report_tmp_id', docargs)
'''
'''
