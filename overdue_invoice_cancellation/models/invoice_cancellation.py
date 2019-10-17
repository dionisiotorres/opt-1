# -*- coding: utf-8 -*-
from datetime import datetime, timedelta, date
import time
from dateutil.relativedelta import relativedelta
from odoo import api, fields, models, _


class AccountConfigSettings(models.TransientModel):
    _inherit = 'account.config.settings'

    days = fields.Integer(string='Valid Days')
    date = fields.Date(string="Date", default=fields.Date.context_today)
    @api.model
    def get_default_days(self, fields):
        days_default = self.env.ref('overdue_invoice_cancellation.overdue_invoice_cancellation_days').value
        return {'days': int(days_default)}

    @api.multi
    def set_days(self):
        for record in self:
            self.env.ref('overdue_invoice_cancellation.overdue_invoice_cancellation_days').write({'value': record.days})

    @api.model
    def get_default_age_values(self, fields):
        conf = self.env['ir.config_parameter']
        return {
            'days': int(conf.get_param('age_verification.min_age')),
        }

    @api.one
    def set_age_values(self):
        conf = self.env['ir.config_parameter']
        conf.set_param('days', self.days)

    def invoice_cancellation(self):
        account_invoices = self.env['account.invoice'].search([('state', '=', 'open')])
        #print account_invoices
        print "selfff======>>>>>",self
        #latest_rec = self.search([], limit=1, order='create_date desc')
        #print "latest_rec====>>>>",latest_rec.days
        days_default = self.env.ref('overdue_invoice_cancellation.overdue_invoice_cancellation_days').value
        print "****************",int(days_default)
        #stop
        for account_invoice in account_invoices:
            if account_invoice.date_due:
                date = datetime.today().strftime("%d/%m/%Y")
                #date = self.date.strftime("%d/%m/%Y")
                #print "current date====>>>>",date
                days = int(days_default)
                #print "current days====>>>>",days
                final_date = (datetime.strptime(date,"%d/%m/%Y") + relativedelta(days=days))
                #convert_final_date = final_date.strftime("%d/%m/%Y")
                #print type(final_date)
                str_to_date = datetime.strptime(account_invoice.date_due, '%Y-%m-%d')
                due_date = str_to_date.strftime("%d/%m/%Y")
                print "final_date====>>>>",final_date
                print"str_to_date====>>>>", str_to_date
                delta=relativedelta(final_date, str_to_date)
                diffrent_days = delta.days
                print "different Days====>>>>",diffrent_days
                #stop
                #account_invoice.filtered(lambda a:a.diffrent_days > 0)
                #print "so name====>>>>",account_invoice.origin
                if diffrent_days > 0:
                    #print"in if condition"
                    mail = self.env['mail.mail']
                    mail_message = self.env['mail.message']
                    #print "==========>>>>",self.env.user.id
                    #stop
                    user = self.env.user
                    body = "Dear <b>%s</b>,<br>Your Invoice No: <b>%s</b> and Due Date is <b>%s </b>and Your Outstanding Amount is <b>%s</b>,<br> Please pay the mount Between <b> %s Days</b>,  <br><br><br><br><br><br><br><b>%s<b>"%(account_invoice.partner_id.name,account_invoice.number, due_date,account_invoice.residual, diffrent_days, self.env.user.name)
                    #name = account_invoice._name
                    #print "name=====>>>>",name
                    #stop
                    values = {
                        'subject': "Dear "+ account_invoice.partner_id.name + " Please Clear the Outstanding ",
                        'author_id': self.env.user.id,
                        'email_from': self.env.user.partner_id.email,#self.env.user.partner_id.email,
                        'email_to': account_invoice.partner_id.email,
                        'recipient_ids': [(6, 0, [account_invoice.partner_id.id])],#[(6, 0, [self.partner_id.id])],#[(4,self.partner_id.id)],
                        #'scheduled_date': datetime.now(),
                        'model': account_invoice._name,# self._name,
                        'res_id': account_invoice.id,#self.id,
                        'message_type':'notification',
                        'notification': True,
                        'body_html': body,
                    }
                    print values
                    #print self._name
                    #stop
                    result = mail.create(values)
                    result.send()
                    mail_message_values = {'res_id':account_invoice.id,
                                           'model': account_invoice._name,
                                           'message_type':'notification',
                                           'body':body,
                                           'date':datetime.now(),}
                    mail_message_result = mail_message.create(mail_message_values)

                    print "done"
                    #stop
                else:
                    print "in else",account_invoice.origin
                    #stop
                    so_number = account_invoice.origin
                    print "so_number=====>>>>",so_number
                    if so_number:
                        so_record = self.env['sale.order'].search([('name', '=', so_number)])
                        print "so_record====>>>>",so_record
                        if so_record:
                            journal_name = account_invoice.journal_id.name
                            account_journal_record = self.env['account.journal'].search([('name', '=', journal_name)])
                            account_journal_record.update({'update_posted': True})
                            move_name = account_invoice.move_id.name
                            account_move_record = self.env['account.move'].search([('name', '=', move_name)])
                            button_cancel= account_move_record.button_cancel()
                            print "button_cancel====>>>",button_cancel
                            action_invoice_cancel= account_invoice.action_invoice_cancel()
                            print "action_invoice_cancel====>>>",action_invoice_cancel
                            #stop
                            action_cancel= so_record.action_cancel()
                            print "action_cancel====>>>",action_cancel
                            unlink = so_record.unlink()
                            print "unlink====>>>",unlink
                            #stop
                            #super(SaleOrder, self).action_cancel()
                            #account_invoice.unlink()








