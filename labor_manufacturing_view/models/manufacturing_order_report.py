import time
import datetime

from odoo import api, models, _
from odoo.exceptions import UserError
from operator import itemgetter
import json


class ManufacturingOrdersReport(models.AbstractModel):
    _name = 'report.labor_manufacturing_view.report_labor_profile'

    @api.model
    def render_html(self, docids, data=None):
        if not data.get('form') or not self.env.context.get('active_model') or not self.env.context.get('active_id'):
            raise UserError(_("Form content is missing, this report cannot be printed."))
        self.model = self.env.context.get('active_model')
        docs = self.env[self.model].browse(self.env.context.get('active_id'))
        employee_id = data['form']['employee_id'][0]
        emp_obj = self.env['hr.employee'].search([('id', '=', employee_id)])
        in_out = emp_obj.barcode
        pause = emp_obj.pause
        block = emp_obj.block
        assigned_emp_obj = self.env['assigned.employee'].search([('employee_id', '=', employee_id), ('mrp_id.name','=', data['form']['mo_number'])])
        move_raw_ids = assigned_emp_obj.mrp_id.move_raw_ids
        work_center = assigned_emp_obj.workcenter_id.name
        docargs = {
            'doc_ids': self.ids,
            'doc_model': self.model,
            'data': data['form'],
            'docs': docs,
            'in_out': in_out,
            'pause': pause,
            'block': block,
            'workcenter': work_center,
            'move_raw_ids': move_raw_ids,
        }
        return self.env['report'].render('labor_manufacturing_view.report_labor_profile', docargs)
