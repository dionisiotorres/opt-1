# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

#from openerp import api, fields, models, _
from datetime import datetime
from odoo import api, fields, models, _
from cStringIO import StringIO
import xlwt
import base64

class ExportCsvReportPurchase(models.TransientModel):
    _name= "export.csv.report.purchase"

    excel_file = fields.Binary('CSV Report')
    file_name = fields.Char('Report File Name', size=64, readonly=True)
    
class PurchaseOrder(models.Model):
    _inherit= "purchase.order" 
       
    @api.multi    
    def print_purchase_order_xls(self):
        filename = "Purchase Order Report.xls"
        workbook = xlwt.Workbook()
        left_bold = xlwt.easyxf('align: horiz left; font: bold on;')
        po_title = xlwt.easyxf('align: vertical center, horizontal center; font: bold on;font:height 360;border: top medium, bottom medium, right medium, left medium;')
        center_bold = xlwt.easyxf('align:vertical center, horizontal center; font: bold on; border: bottom medium;')
        
        #purchase code
        active_ids = self._context.get('active_ids')
        active_model = self._context.get('active_model')
        for selected_id in active_ids:
            row = 0
            col = 0
            state = ''
            selected_record = self.env['purchase.order'].browse(selected_id)            
            if selected_record.state == 'draft' or selected_record.state == 'sent':
                title = 'Request for Quotation'
                worksheet_name = 'RFQ-' + selected_record.name[2:]  
                if selected_record.state == 'draft':
                    state = 'RFQ' 
                elif selected_record.state == 'sent':
                    state = 'RFQ Sent'                
            else:
                title = 'Purchase Order'
                worksheet_name = 'PO-' + selected_record.name[2:] 
                if selected_record.state == 'cancel':
                    state = 'Cancelled' 
                elif selected_record.state == 'done':
                    state = 'Locked'
                elif selected_record.state == 'to approve':
                    state = 'To Approve'
                elif selected_record.state == 'purchase':
                    state = 'Purchase Order'
            worksheet = workbook.add_sheet(worksheet_name)     
            #title
            new_row = row + 1
            worksheet.write_merge(row, new_row, 0, 6, title + ' ' + selected_record.name, po_title)
            row += 3
            #Date / Payment Term / Vendor Ref.
            worksheet.write(3, 3, 'Date', left_bold)
            #date time change formate
            date_order = selected_record.date_order
            datetime_object = datetime.strptime(date_order, '%Y-%m-%d %H:%M:%S')
            final_date_order = datetime_object.strftime("%m/%d/%Y %H:%M:%S")
            worksheet.write_merge(3, 3, 4, 5, final_date_order)
            
            worksheet.write(4, 3, 'Payment Term', left_bold)
            if selected_record.payment_term_id:
                worksheet.write_merge(4, 4, 4, 5, selected_record.payment_term_id.name)
                
            worksheet.write(5, 3, 'Vendor Ref.', left_bold)
            if selected_record.partner_ref:
                worksheet.write_merge(5, 5, 4, 5, selected_record.partner_ref)
            
            worksheet.write(6, 3, 'State', left_bold)
            worksheet.write_merge(6, 6, 4, 5, state)
            
            #customer detail
            worksheet.write(row, col, 'Vendor', left_bold)
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
            worksheet.write(row, 0, 'Scheduled Date', left_bold)
            worksheet.write(row, 1, 'Approval Date', left_bold)
            worksheet.col(2).width = 256 * 16 #16 characters wide (-ish)
            worksheet.write(row, 2, 'Incoterm', left_bold)
            worksheet.write(row, 3, 'Fiscal Position', left_bold)
            row +=1
            if selected_record.date_planned:
                #date time change formate
                date_planned = selected_record.date_planned
                datetime_object = datetime.strptime(date_planned, '%Y-%m-%d %H:%M:%S')
                final_date_planned = datetime_object.strftime("%m/%d/%Y %H:%M:%S")
                worksheet.write(row, 0, final_date_planned)
            
            if selected_record.date_approve:
                #date time change formate
                date_approve = selected_record.date_approve
                datetime_object = datetime.strptime(date_approve, '%Y-%m-%d')
                final_date_approve = datetime_object.strftime("%m/%d/%Y")
                worksheet.write(row, 1, final_date_approve)
            
            if selected_record.incoterm_id:
                worksheet.write(row, 2, selected_record.incoterm_id.name)
                
            if selected_record.fiscal_position_id:
                worksheet.write(row, 3, selected_record.fiscal_position_id.name)
            #order line operations
            row += 3
            
            #order line title
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
            worksheet.write(row,col, 'Sub Total', xlwt.easyxf('align: horiz right; font: bold on; border: bottom medium;'))
            col+=1    
            total_lable_col = 4
            currency_id= self.env.user.company_id.currency_id.symbol 
            if selected_record.order_line:
                #orderline value
                for order_line_record in selected_record.order_line:
                    col=0
                    row+=1
                    #set currency
                    currency_id = order_line_record.currency_id.symbol
                    
                    if order_line_record.product_id:
                        worksheet.write(row,col,order_line_record.product_id.name_get()[0][1])
                    col+=1
                    if order_line_record.name:
                        worksheet.write(row,col,order_line_record.name)
                    col+=1
                    if order_line_record.product_qty:
                        worksheet.write(row,col, order_line_record.product_qty, xlwt.easyxf('align:vertical center, horizontal center;'))
                    col+=1
                    if order_line_record.product_uom:
                        worksheet.write(row,col, order_line_record.product_uom.name, xlwt.easyxf('align:vertical center, horizontal center;'))
                    col+=1
                    #set total_lable_column
                    total_lable_col = col
                    if order_line_record.price_unit:
                        worksheet.write(row,col, order_line_record.price_unit)
                    col+=1
                    if order_line_record.taxes_id:
                        worksheet.write(row,col,', '.join(map(lambda x: x.name, order_line_record.taxes_id)))
                    col+=1
                    if order_line_record.price_subtotal:
                        worksheet.write(row,col, str(order_line_record.price_subtotal) + currency_id, xlwt.easyxf('align: horiz right;'))
                    
            row +=2  
            #set Final total of purchase order  
            worksheet.write_merge(row,row,total_lable_col,total_lable_col + 1, 'Total Without Taxes', xlwt.easyxf('align: horiz left; font: bold on; border: top medium;'))
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
        export_obj = self.env['export.csv.report.purchase'].create({'excel_file': base64.encodestring(fp.getvalue()), 'file_name': filename})
        fp.close()     
        return{
            'view_mode': 'form',
            'res_id': export_obj.id,
            'res_model': 'export.csv.report.purchase',
            'view_type': 'form',
            'type': 'ir.actions.act_window',
            'context': self._context,
            'target': 'new',
        }
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:                
