# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

#from openerp import api, fields, models, _
from datetime import datetime
from odoo import api, fields, models, _
from cStringIO import StringIO
import xlwt
import base64

class ExportCsvReportAccount(models.TransientModel):
    _name= "export.csv.report.account"

    excel_file = fields.Binary('CSV Report')
    file_name = fields.Char('Report File Name', size=64, readonly=True)
    
class AccountInvoice(models.Model):
    _inherit= "account.invoice" 
       
    @api.multi    
    def print_account_invoice_xls(self):
        filename = "Account Invoice Report.xls"
        workbook = xlwt.Workbook()
        left_bold = xlwt.easyxf('align: horiz left; font: bold on;')
        po_title = xlwt.easyxf('align: vertical center, horizontal center; font: bold on;font:height 360;border: top medium, bottom medium, right medium, left medium;')
        center_bold = xlwt.easyxf('align:vertical center, horizontal center; font: bold on; border: bottom medium;')
        
        #A/c_inv code
        active_ids = self._context.get('active_ids')
        active_model = self._context.get('active_model')
        for selected_id in active_ids:
            row = 0
            col = 0
            state = ''
            selected_record = self.env['account.invoice'].browse(selected_id) 
            
            #state
            if selected_record.state == 'draft':
                state = 'Draft' 
            elif selected_record.state == 'proforma':
                state = 'Pro-forma'
            elif selected_record.state == 'proforma2':
                    state = 'Pro-forma' 
            elif selected_record.state == 'open':
                state = 'Open'
            elif selected_record.state == 'paid':
                state = 'Paid'
            elif selected_record.state == 'cancel':
                state = 'Cancelled'
           
            #customer Invoice
            if selected_record.type == 'out_invoice':
                Cus_or_ven = 'Customer'
                Cus_or_ven_ref = 'Customer Ref.'
                #set customer ref.
                if selected_record.partner_id.ref:
                    reference = selected_record.partner_id.ref
                else:
                    reference = ''
                sale_or_respons= 'Salesperson'
                if selected_record.state == 'draft':
                    title = 'Draft Invoice'
                    worksheet_name = 'Draft-Inv-' + str(selected_record.id)
                elif selected_record.state == 'proforma' or selected_record.state == 'proforma2' or selected_record.state == 'cancel':
                    title = str(state) + ' ' + 'Invoice'   
                    worksheet_name = str(state) + '-' + 'Inv-' + str(selected_record.id)
                else:
                    title = 'Invoice' + ' ' + selected_record.number
                    worksheet_name = 'INV-' + selected_record.number[9:]
            #customer Refund
            elif selected_record.type == 'out_refund':
                Cus_or_ven = 'Customer'
                Cus_or_ven_ref = 'Customer Ref.'
                #set customer ref.
                if selected_record.partner_id.ref:
                    reference = selected_record.partner_id.ref
                else:
                    reference = ''
                sale_or_respons= 'Salesperson'
                title = str(state) + ' ' + 'Refund'
                worksheet_name = str(state) + '-' + 'INV-RF-' + str(selected_record.id)
                if selected_record.number:
                    title = 'Refund' + ' ' + selected_record.number
                    worksheet_name = 'INV-RF-' + selected_record.number[9:]
                    
                
            #Vendor Invoice        
            elif selected_record.type == 'in_invoice':
                Cus_or_ven = 'Vendor'
                Cus_or_ven_ref = 'Vendor Ref.'
                reference = selected_record.reference
                sale_or_respons= 'Responsible'
                if selected_record.state == 'draft':
                    title = 'Draft Vendor Bill'
                    worksheet_name = 'Draft-Bill-' + str(selected_record.id)
                elif selected_record.state == 'proforma' or selected_record.state == 'proforma2' or selected_record.state == 'cancel':
                    title = str(state) + ' ' + 'Vendor Bill'  
                    worksheet_name = str(state) + '-' + 'Bill-' + str(selected_record.id)
                else:
                    title = 'Vendor Bill' + ' ' + selected_record.number
                    worksheet_name = 'Bill-' + selected_record.number[10:]
            #vendor Refund
            else:
                Cus_or_ven = 'Vendor'
                Cus_or_ven_ref = 'Vendor Ref.'
                reference = selected_record.reference
                sale_or_respons= 'Responsible'
                title = str(state) + ' ' + 'Vendor Refund'  
                worksheet_name = str(state) + '-' + 'Bill-RF-' + str(selected_record.id)
                if selected_record.number:
                    title = 'Vendor Refund' + ' ' + selected_record.number
                    worksheet_name = 'Bill-RF-' + str(selected_record.number[10:])
            worksheet = workbook.add_sheet(worksheet_name)     
            #title
            new_row = row + 1
            worksheet.write_merge(row, new_row, 0, 6, title, po_title)
            row += 3
            #Date / Payment Term / Vendor Ref.
            worksheet.write(3, 3, 'Date', left_bold)
            #date change formate
            if selected_record.date_invoice:
                date_invoice = selected_record.date_invoice
                datetime_object = datetime.strptime(date_invoice, '%Y-%m-%d')
                final_date_invoice = datetime_object.strftime("%m/%d/%Y")
                worksheet.write_merge(3, 3, 4, 5, final_date_invoice)
            
            worksheet.write(4, 3, 'Payment Term', left_bold)
            if selected_record.payment_term_id:
                worksheet.write_merge(4, 4, 4, 5, selected_record.payment_term_id.name)
                
            worksheet.write(5, 3, Cus_or_ven_ref, left_bold)
            if reference:
                worksheet.write_merge(5, 5, 4, 5, reference)
            
            worksheet.write(6, 3, 'State', left_bold)
            worksheet.write_merge(6, 6, 4, 5, state)    
            
            #customer/Vendor detail
            worksheet.write(row, col, Cus_or_ven, left_bold)
            col += 1
            worksheet.write(row, col, selected_record.partner_id.name, left_bold)
            worksheet.col(col).width = 256 * 20 #20 characters wide (-ish)
            row += 1
            if selected_record.partner_id.street:
                worksheet.write(row,col,selected_record.partner_id.street)
                row += 1
            if selected_record.partner_id.street2:
                worksheet.write(row,col,selected_record.partner_id.street2)
                row += 1
            if selected_record.partner_id.state_id:
                worksheet.write(row, col, selected_record.partner_id.state_id.name)
                row += 1
            if selected_record.partner_id.zip:
                worksheet.write(row,col,selected_record.partner_id.zip)
                row+=1
            if selected_record.partner_id.country_id:
                worksheet.write(row,col,selected_record.partner_id.country_id.name)
                row+=1
            if selected_record.partner_id.phone:
                worksheet.write(row,col,selected_record.partner_id.phone)
                row+=1
            row+=1    
            worksheet.write(row, 0, sale_or_respons, left_bold)
            worksheet.write(row, 1, 'Accounting Date', left_bold)
            worksheet.col(2).width = 256 * 16 #16 characters wide (-ish)
            worksheet.write(row, 2, 'Reference/Desc.', left_bold)
            worksheet.write(row, 3, 'Fiscal Position', left_bold)
            row +=1
            
            if selected_record.user_id:
                worksheet.write(row, 0, selected_record.user_id.name)
            if selected_record.date:
                #date change formate
                accounting_date = selected_record.date
                datetime_object = datetime.strptime(accounting_date, '%Y-%m-%d')
                final_accounting_date = datetime_object.strftime("%m/%d/%Y")
                worksheet.write(row, 1, final_accounting_date)
            if selected_record.name:
                worksheet.write(row, 2, selected_record.name)
            if selected_record.fiscal_position_id:
                worksheet.write(row, 3, selected_record.fiscal_position_id.name)
            #invoice line operations
            row += 3
            
            #invoice line title
            col = 0
            worksheet.write(row,col,'Product', xlwt.easyxf('align: horiz left; font: bold on; border: bottom medium;'))
            worksheet.col(col).width = 256 * 24 #24 characters wide (-ish)
            col+=1
            worksheet.write(row,col,'Description', xlwt.easyxf('align: horiz left; font: bold on; border: bottom medium;'))
            worksheet.col(col).width = 256 * 28 #28 characters wide (-ish)
            col+=1
            worksheet.write(row,col,'Qty', center_bold)
            col+=1
            worksheet.write(row,col,'Product UOM', center_bold)
            worksheet.col(col).width = 256 * 16 #16 characters wide (-ish)
            col+=1
            worksheet.write(row,col,'Unit Price', xlwt.easyxf('align: horiz right; font: bold on; border: bottom medium;'))
            col+=1
            worksheet.write(row,col,'Taxes', center_bold)
            col+=1
            worksheet.write(row,col, 'Tax Excluded Price', xlwt.easyxf('align: horiz right; font: bold on; border: bottom medium;'))
            worksheet.col(col).width = 256 * 20 #20 characters wide (-ish)
            col+=1
            total_lable_col = 4
            currency_id= self.env.user.company_id.currency_id.symbol        
            if selected_record.invoice_line_ids:
                #invoice line value
                for invoice_line_record in selected_record.invoice_line_ids:
                    col=0
                    row+=1
                    #set currency
                    currency_id = invoice_line_record.currency_id.symbol
                    
                    if invoice_line_record.product_id:
                        worksheet.write(row,col,invoice_line_record.product_id.name_get()[0][1])
                    col+=1
                    if invoice_line_record.name:
                        worksheet.write(row, col, invoice_line_record.name,)
                    col+=1
                    if invoice_line_record.quantity:
                        worksheet.write(row,col, invoice_line_record.quantity, xlwt.easyxf('align:vertical center, horizontal center;'))
                    col+=1
                    if invoice_line_record.uom_id:
                        worksheet.write(row,col, invoice_line_record.uom_id.name, xlwt.easyxf('align:vertical center, horizontal center;'))
                    col+=1
                    #set total_lable_column
                    total_lable_col = col
                    if invoice_line_record.price_unit:
                        worksheet.write(row,col, invoice_line_record.price_unit)
                    col+=1
                    if invoice_line_record.invoice_line_tax_ids:
                        worksheet.write(row,col,', '.join(map(lambda x: x.name, invoice_line_record.invoice_line_tax_ids)), xlwt.easyxf('align:vertical center, horizontal center;'))
                    col+=1
                    if invoice_line_record.price_subtotal:
                        worksheet.write(row,col, str(invoice_line_record.price_subtotal) + currency_id, xlwt.easyxf('align: horiz right;'))
                        
                    
            row +=2  
            #set Final total of Account invoice 
            worksheet.write_merge(row,row,total_lable_col,total_lable_col + 1, 'Sub Total', xlwt.easyxf('align: horiz left; font: bold on; border: top medium;'))
            if selected_record.amount_untaxed:
                worksheet.write(row,col, str(selected_record.amount_untaxed) + currency_id, xlwt.easyxf('align: horiz right; border: top medium;'))
            else:
                worksheet.write(row, 6, str(0.0) + currency_id, xlwt.easyxf('align: horiz right; border: top medium;'))
            row+=1
            
            if selected_record.amount_tax:
                worksheet.write_merge(row,row,total_lable_col,total_lable_col + 1, 'Taxes', xlwt.easyxf('align: horiz left; font: bold on;'))
                worksheet.write(row,col, str(selected_record.amount_tax) + currency_id, xlwt.easyxf('align: horiz right;'))
                row+=1
            worksheet.write_merge(row,row,total_lable_col,total_lable_col + 1, 'Total', xlwt.easyxf('align: horiz left; font: bold on; border: top medium;'))
            if selected_record.amount_total:
                worksheet.write(row,col, str(selected_record.amount_total) + currency_id,xlwt.easyxf('align: horiz right; border: top medium;'))
            else:
                worksheet.write(row,6, str(0.0) + currency_id,xlwt.easyxf('align: horiz right; border: top medium;')) 
                                   
        fp = StringIO()
        workbook.save(fp)
        export_obj = self.env['export.csv.report.account'].create({'excel_file': base64.encodestring(fp.getvalue()), 'file_name': filename})
        fp.close()     
        return{
            'view_mode': 'form',
            'res_id': export_obj.id,
            'res_model': 'export.csv.report.account',
            'view_type': 'form',
            'type': 'ir.actions.act_window',
            'context': self._context,
            'target': 'new',
        }
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:                
