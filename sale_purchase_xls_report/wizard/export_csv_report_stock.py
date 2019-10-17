# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

#from openerp import api, fields, models, _
from datetime import datetime
from odoo import api, fields, models, _
from cStringIO import StringIO
import xlwt
import base64

class ExportCsvReportStock(models.TransientModel):
    _name= "export.csv.report.stock"

    excel_file = fields.Binary('CSV Report')
    file_name = fields.Char('Report File Name', size=64, readonly=True)
    
class Picking(models.Model):
    _inherit= "stock.picking" 
       
    @api.multi    
    def print_delivery_order_xls(self):
        filename = "Picking/Delivery Order Report.xls"
        workbook = xlwt.Workbook()
        left_bold = xlwt.easyxf('align: horiz left; font: bold on;')
        sp_title = xlwt.easyxf('align: vertical center, horizontal center; font: bold on;font:height 360;border: top medium, bottom medium, right medium, left medium;')
        center_bold = xlwt.easyxf('align:vertical center, horizontal center; font: bold on; border: bottom medium;')
        
        #Stock Picking code
        active_ids = self._context.get('active_ids')
        active_model = self._context.get('active_model')
        for selected_id in active_ids:
            row = 0
            col = 0
            state = ''
            selected_record = self.env['stock.picking'].browse(selected_id)
            
            #state
            if selected_record.state == 'draft':
                state = 'Draft' 
            elif selected_record.state == 'cancel':
                state = 'Cancelled'
            elif selected_record.state == 'waiting':
                state = 'Waiting Another Operation' 
            elif selected_record.state == 'confirmed':
                state = 'Waiting Availability'
            elif selected_record.state == 'partially_available':
                state = 'Partially Available'
            elif selected_record.state == 'assigned':
                state = 'Available'
            elif selected_record.state == 'done':
                state = 'Done'
            
            record_name = selected_record.name
            sname = str(record_name.split('/')[-1])
            fname = str(record_name.split('/')[-2])
            
            #set title and worksheet name 
            worksheet_name = str(fname) + '-' + str(sname) + '-' + str(selected_record.id)
            title = selected_record.name
            
            if selected_record.picking_type_code == 'incoming':
                Cus_or_ven = 'Vendor'
                source_or_dest = 'Destination Location'
                title = 'Picking' + ' ' + str(selected_record.name)
            else:
                Cus_or_ven = 'Customer'
                source_or_dest = 'Source Location'
                title = 'Delivery' + ' ' + str(selected_record.name)
                
            worksheet = workbook.add_sheet(worksheet_name)     
            
            #title
            new_row = row + 1
            worksheet.write_merge(row, new_row, 0, 6, title, sp_title)
            row += 3
            #Date / Payment Term / Vendor Ref.
            worksheet.write(3, 0, 'Date', left_bold)
            #date time change formate
            if selected_record.min_date:
                min_date = selected_record.min_date
                datetime_object = datetime.strptime(min_date, '%Y-%m-%d %H:%M:%S')
                final_min_date = datetime_object.strftime("%m/%d/%Y %H:%M:%S")
                worksheet.write_merge(3, 3, 1, 2, final_min_date)
            
            worksheet.write(3, 4, 'State', left_bold)
            worksheet.write_merge(3, 3, 5, 6, state)
            
            worksheet.write(4, 0, 'Source Document', left_bold)
            if selected_record.origin:
                worksheet.write_merge(4, 4, 1, 2, selected_record.origin)
            worksheet.write(4, 4, 'Location', left_bold)
            location = ''
            if source_or_dest == 'Destination Location':
                if selected_record.location_dest_id:
                    location = selected_record.location_dest_id.name_get()[0][1]
            if source_or_dest == 'Source Location':
                if selected_record.location_id:
                    location = selected_record.location_id.name_get()[0][1]
            if location:        
                worksheet.write_merge(4, 4, 5, 6, location)
            row +=3
            #not outgoing
            if selected_record.picking_type_code != 'outgoing':
                #customer detail
                worksheet.write(row, col, Cus_or_ven, left_bold)
                new_col = 3
                worksheet.write(row, new_col, 'Warehouse', left_bold)
                col += 1
                new_col +=1 
                #partner
                if selected_record.partner_id:
                    worksheet.write(row, col, selected_record.partner_id.name, left_bold)
                    worksheet.col(col).width = 256 * 20 #20 characters wide (-ish)
                #w/H
                if selected_record.picking_type_id.warehouse_id.partner_id:
                    worksheet.write(row, new_col, selected_record.picking_type_id.warehouse_id.partner_id.name, left_bold)
                    worksheet.col(new_col).width = 256 * 20 #20 characters wide (-ish)
                
                row += 1
                new_row = row
                #partner
                if selected_record.partner_id.street:
                    worksheet.write(row, col, selected_record.partner_id.street)
                    row += 1
                #w/H
                if selected_record.picking_type_id.warehouse_id.partner_id.street:
                    worksheet.write(new_row, new_col, selected_record.picking_type_id.warehouse_id.partner_id.street)
                    new_row += 1
                #partner    
                if selected_record.partner_id.street2:
                    worksheet.write(row, col, selected_record.partner_id.street2)
                    row += 1
                #W/H
                if selected_record.picking_type_id.warehouse_id.partner_id.street2:
                    worksheet.write(new_row, new_col, selected_record.picking_type_id.warehouse_id.partner_id.street2)
                    new_row += 1
                #partner       
                if selected_record.partner_id.state_id:
                    worksheet.write(row, col, selected_record.partner_id.state_id.name)
                    row += 1
                #W/H      
                if selected_record.picking_type_id.warehouse_id.partner_id.state_id:
                    worksheet.write(new_row, new_col, selected_record.picking_type_id.warehouse_id.partner_id.state_id.name)
                    new_row += 1
                #partner     
                if selected_record.partner_id.zip:
                    worksheet.write(row, col, selected_record.partner_id.zip)
                    row+=1
                #W/H     
                if selected_record.picking_type_id.warehouse_id.partner_id.zip:
                    worksheet.write(new_row, new_col, selected_record.picking_type_id.warehouse_id.partner_id.zip)
                    new_row+=1
                #partner    
                if selected_record.partner_id.country_id:
                    worksheet.write(row, col, selected_record.partner_id.country_id.name)
                    row+=1
                #W/H    
                if selected_record.picking_type_id.warehouse_id.partner_id.country_id:
                    worksheet.write(new_row , new_col, selected_record.picking_type_id.warehouse_id.partner_id.country_id.name)
                    new_row+=1
                #partner 
                if selected_record.partner_id.phone:
                    worksheet.write(row, col, selected_record.partner_id.phone)
                    row+=1
                #partner 
                if selected_record.picking_type_id.warehouse_id.partner_id.phone:
                    worksheet.write(new_row, new_col, selected_record.picking_type_id.warehouse_id.partner_id.phone)
                    new_row+=1
                max_row = max(row,new_row)    
                row = max_row
            #if out going
            else:
                #customer detail
                worksheet.write(row, col, Cus_or_ven, left_bold)
                col += 1
                #partner
                if selected_record.partner_id:
                    worksheet.write(row, col, selected_record.partner_id.name, left_bold)
                    worksheet.col(col).width = 256 * 20 #20 characters wide (-ish)
                    row += 1
                #partner
                if selected_record.partner_id.street:
                    worksheet.write(row, col, selected_record.partner_id.street)
                    row += 1
                #partner    
                if selected_record.partner_id.street2:
                    worksheet.write(row, col, selected_record.partner_id.street2)
                    row += 1
                #partner       
                if selected_record.partner_id.state_id:
                    worksheet.write(row, col, selected_record.partner_id.state_id.name)
                    row += 1
                #partner     
                if selected_record.partner_id.zip:
                    worksheet.write(row, col, selected_record.partner_id.zip)
                    row+=1
                #partner    
                if selected_record.partner_id.country_id:
                    worksheet.write(row, col, selected_record.partner_id.country_id.name)
                    row+=1
                #partner 
                if selected_record.partner_id.phone:
                    worksheet.write(row, col, selected_record.partner_id.phone)
                    row+=1
                
            row+=2   
            #set(Origin)/Owner/Commitment/Scheduled Date 
            worksheet.write(row, 0, 'Order (Origin)', left_bold)
            if selected_record.picking_type_code != 'outgoing':
                worksheet.write(row, 1, 'Owner', left_bold)
                worksheet.col(2).width = 256 * 16 #16 characters wide (-ish)
                worksheet.write_merge(row, row, 2, 3, 'Commitment Date', left_bold)
            worksheet.write_merge(row, row, 4, 5,'Scheduled Date', left_bold)
            row +=1
            
            if selected_record.origin:
                worksheet.write(row, 0, selected_record.origin)
            if selected_record.picking_type_code != 'outgoing':    
                if selected_record.owner_id:
                    worksheet.write(row, 1, selected_record.owner_id.name)
                if selected_record.date:
                    date = selected_record.date
                    datetime_object = datetime.strptime(date, '%Y-%m-%d %H:%M:%S')
                    final_date = datetime_object.strftime("%m/%d/%Y %H:%M:%S")
                    worksheet.write_merge(row, row, 2, 3, final_date)
            if selected_record.min_date:
                min_date = selected_record.min_date
                datetime_object = datetime.strptime(min_date, '%Y-%m-%d %H:%M:%S')
                final_min_date = datetime_object.strftime("%m/%d/%Y %H:%M:%S")
                worksheet.write_merge(row, row, 4, 5,  final_min_date)
            
            #move line operations
            row += 3
            
            #order line title
            col = 0
            worksheet.write(row, col, 'Product', xlwt.easyxf('align: horiz left; font: bold on; border: bottom medium;'))
            worksheet.col(col).width = 256 * 24 #24 characters wide (-ish)
            col+=1
            worksheet.write(row, col, 'Qty', center_bold)
            col+=1
            worksheet.write(row, col, 'Product UOM', center_bold)
            worksheet.col(col).width = 256 * 16 #16 characters wide (-ish)
            col+=1
            worksheet.write(row, col, 'Status', center_bold)
            col+=1
            worksheet.write(row, col, source_or_dest, center_bold)
            worksheet.col(col).width = 256 * 24 #24 characters wide (-ish)
            col+=1
            
            if selected_record.move_lines:
                #orderline value
                for move_line_record in selected_record.move_lines:
                    col=0
                    row+=1
                    
                    if move_line_record.product_id:
                        worksheet.write(row, col, move_line_record.product_id.name_get()[0][1])
                    col+=1
                    if move_line_record.product_uom_qty:
                        worksheet.write(row, col, move_line_record.product_uom_qty, xlwt.easyxf('align:vertical center, horizontal center;'))
                    col+=1
                    if move_line_record.product_uom:
                        worksheet.write(row, col, move_line_record.product_uom.name, xlwt.easyxf('align:vertical center, horizontal center;'))
                    col+=1
                    
                    if move_line_record.state:
                        #state_move
                        if move_line_record.state == 'draft':
                            state_move = 'New' 
                        elif move_line_record.state == 'cancel':
                            state_move = 'Cancelled'
                        elif move_line_record.state == 'waiting':
                            state_move = 'Waiting Another Move' 
                        elif move_line_record.state == 'confirmed':
                            state_move = 'Waiting Availability'
                        elif move_line_record.state == 'partially_available':
                            state_move = 'Partially Available'
                        elif move_line_record.state == 'assigned':
                            state_move = 'Available'
                        elif move_line_record.state == 'done':
                            state_move = 'Done'
                        worksheet.write(row, col, state_move, xlwt.easyxf('align: vertical center, horizontal center;'))
                    col+=1
                    location = ''
                    if source_or_dest == 'Destination Location':
                        if move_line_record.location_dest_id:
                            location = move_line_record.location_dest_id.name_get()[0][1]
                    if source_or_dest == 'Source Location':
                        if move_line_record.location_id:
                            location = move_line_record.location_id.name_get()[0][1]
                    if location:        
                        worksheet.write(row , col, location, xlwt.easyxf('align: vertical center, horizontal center;'))
            row +=2  
            
        fp = StringIO()
        workbook.save(fp)
        export_obj = self.env['export.csv.report.stock'].create({'excel_file': base64.encodestring(fp.getvalue()), 'file_name': filename})
        fp.close()     
        return{
            'view_mode': 'form',
            'res_id': export_obj.id,
            'res_model': 'export.csv.report.stock',
            'view_type': 'form',
            'type': 'ir.actions.act_window',
            'context': self._context,
            'target': 'new',
        }
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:                
