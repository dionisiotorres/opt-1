from odoo import models, fields, api, _
from odoo.exceptions import UserError
from datetime import datetime


class MyPages(models.Model):
    _name = 'my.pages'
    
    date = fields.Date('Date')
    name = fields.Char('Name')
    department = fields.Many2one('hr.department','Department')
    check_in = fields.Datetime('Check In')
    check_out = fields.Datetime('Check Out')
    mo_no = fields.Many2one('mrp.production','Mo No')
    operation = fields.Many2one('mrp.routing.workcenter','Operation')
    workcenter = fields.Many2one('mrp.workcenter','WorkCenter')
    
class LaborPages(models.Model):
    _name = 'labor.pages'
    
    date = fields.Date('Date')
    name = fields.Char('Name')
    department = fields.Many2one('hr.department','Department')
    working_time = fields.Many2one('resource.calendar','WorkingTime')
    role = fields.Many2one('hr.job','Role')
    check_in = fields.Datetime('Check In')
    check_out = fields.Datetime('Check Out')
    mo_no = fields.Many2one('mrp.production','Mo No')
    operation = fields.Many2one('mrp.routing.workcenter','Operation')
    workcenter = fields.Many2one('mrp.workcenter','WorkCenter')
    
class Employee(models.Model):
    _inherit = 'hr.employee'

    is_assign_emp = fields.Boolean('Is Assign Boolean?')

class AssignEmployee(models.Model):
    _inherit = 'assigned.employee'

    # @api.model
    # def create(self, vals):
    #     res = super(AssignEmployee, self).create(vals)
        # if res.employee_id.is_assign_emp:
        #     raise UserError("Labor Can't More Than One Assign Mo.")
        # elif not res.employee_id.is_assign_emp:
        #
        #     res.employee_id.is_assign_emp = True
        # return res

    @api.multi
    def write(self, vals):
        # if vals:
        #     date = datetime.now()
        #     vals.update({'record_date': date})

        if 'unactive' in vals:
            if vals.get('unactive') == True:
                date = datetime.now()
                vals.update({'record_date': date})
                self.employee_id.is_assign_emp = False
                wo = self.env['mrp.workorder'].search([('emp_id','=',self.employee_id.id), ('assign_emp_id','=', self.id)])
                mm = self.env['machine.management'].search([('employee_ids.employee_id','=',self.employee_id.id),('operation_id','=',self.operation_id.id),('mrp_production_id','=', self.mrp_id.id)])
                if wo.state != 'done' and mm.state != 'done':
                    raise UserError("Before unactive Employee, need to finish workorder and machine management of related employee.")
            elif vals.get('unactive') == False:
                self.employee_id.is_assign_emp = True
        if vals.get('record_date'):
            profile = self.env['labor.mrp'].search([('employee_id', '=', self.employee_id.id), ('mo_number', '=', self.mrp_id.name)], order='id')
            if profile:
                profile[-1].check_out = datetime.now()
        res = super(AssignEmployee, self).write(vals)
        return res

    # @api.multi
    # @api.onchange('unactive')
    # def onchange_unactive(self):
        # print '\n onchange unactive called ', self

        # if not self.record_date:
        #     if self.unactive:
        #         self.record_date = fields.datetime.now()



    record_date = fields.Datetime('Record Date')

class LaborMrp(models.Model):
    _inherit = "labor.mrp"
    
    @api.multi
    def check_in_out(self,next_action):
        last_id = self.env['hr.attendance'].search([('employee_id','=',self.employee_id.id)])
#         print"####################",last_id.sorted('id',reverse = True)[0]
        last_id = last_id.sorted('id',reverse = True)[0]
        if last_id.check_in and not last_id.check_out and self.employee_id.id == last_id.employee_id.id:
#             print"$$$$$$$$$$$$$$$$$$$$$",last_id.check_in
            self.check_in = last_id.check_in 
            
            last_id.employee_id.attendance_action(next_action)
            
            action_message = self.env.ref('hr_attendance.hr_attendance_action_kiosk_mode').read()[0]
#             action_message['res_id'] = self.id
#             print"#####%%%%%%%%%%%%%%%%%%%%%%%",action_message
            return action_message

        
        