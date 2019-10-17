# -*- coding: utf-8 -*-

import math
import pytz
from dateutil.relativedelta import relativedelta
from odoo import api, fields, models, _, SUPERUSER_ID
from odoo.addons import decimal_precision as dp
from odoo.exceptions import UserError
from odoo.tools import float_compare, float_round
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
from datetime import datetime

class MachineAssignedEmployee(models.Model):
    _name='machine.assigned.employee'

    employee_id = fields.Many2one('hr.employee', 'Employee')
    assigned_id = fields.Many2one('assigned.employee', 'Assign Employee')
    machine_id = fields.Many2one('machine.management', 'Machine') 
    is_active = fields.Boolean('Active')


class AssignEmployee(models.Model):
    _name='assign.employee'
    
    @api.multi
    @api.onchange('name')
    def onchange_employee(self):
        hr_employee_obj = self.name
        self.department_id = hr_employee_obj.department_id.id
        self.job_id = hr_employee_obj.job_id.id
        self.calendar_id = hr_employee_obj.calendar_id.id
        
        
    date = fields.Date('Date')
    mrp_production_id = fields.Many2one('mrp.production', 'MO Number', required=True,
        index=True, ondelete='cascade', track_visibility='onchange')
    name=fields.Many2one('hr.employee',"Employee Name")
    project_id = fields.Many2one('project.project', 'Project')
    operation_id = fields.Many2one('mrp.routing.workcenter',string="Operation")
    workcenter_id = fields.Many2one('mrp.workcenter',string="Working Center")
    state = fields.Selection([
        ('draft', 'Draft'),
        ('confirmed', 'Confirmed'),
        ('done', 'Done')], string='Status',default='draft')    
    status_boolean = fields.Boolean("Unactive")
    department_id=fields.Many2one('hr.department',string="Department")
    job_id = fields.Many2one('hr.job', 'Role')
    calendar_id = fields.Many2one('resource.calendar', 'Working Time')
    total_working_hour =fields.Float("Total Working Hours")

    
    def button_confirm(self):
        self.write({'state':'confirmed'})

    def button_done(self):
        self.write({'state':'done'})
    

class AssignedEmployee(models.Model):
    _inherit = 'assigned.employee'

    machine_id = fields.Many2one('machine.management', 'MO Number')
    unactive = fields.Boolean('Unactive')
    operation_id = fields.Many2one('mrp.routing.workcenter',string="Operation", required="1")
    workcenter_id = fields.Many2one('mrp.workcenter', string='Work Center', required=True, store=True)

    @api.multi
    def write(self, vals):
        employee = self.env['hr.employee']
        machine = self.env['machine.management']
        machine_employee = self.env['machine.assigned.employee']
        for emp in self:
            machine_assign_id = self.env['machine.assigned.employee'].search([('assigned_id', '=' , emp.id)], limit=1)
            workorder = self.env['mrp.workorder'].search([('operation_id', '=' , emp.operation_id.id), ('production_id', '=', emp.mrp_id.id)], limit=1)
            if workorder and vals:
                if vals.get('machine_id'):
                    machine = self.env['machine.management'].browse(vals.get('machine_id'))
                else:
                    machine = emp.machine_id and emp.machine_id or False
                if vals.get('employee_id'):
                    employee = vals.get('employee_id')
                else:
                    employee = emp.employee_id and emp.employee_id.id or False

                if machine_assign_id and employee != machine_assign_id.employee_id.id:
                    if workorder.state in ['ready', 'pending']:
                        machine_employee.create({
                            'employee_id': employee if employee else False,
                            'is_active': True,
                            'assigned_id': emp.id,
                            'machine_id': machine.id if machine else False
                        })
                    else:
                        if machine_assign_id:
                            machine_assign_id.is_active = False
                        machine_employee.create({
                            'employee_id': employee if employee else False,
                            'is_active': True,
                            'assigned_id': emp.id,
                            'machine_id': machine.id if machine else False
                        })
                if vals.get('operation_id') and vals.get('workcenter_id') and machine:
                    machine.write({'operation_id': vals.get('operation_id'), 'workcenter_id': vals.get('workcenter_id')})
        return super(AssignedEmployee, self).write(vals)

    @api.model
    def create(self, vals):
        res = super(AssignedEmployee, self).create(vals)
        if res and vals.get('machine_id'):
            self.env['machine.assigned.employee'].create({
                        'employee_id': res.employee_id.id or False,
                        'is_active': True,
                        'assigned_id': res.id,
                        'machine_id': vals.get('machine_id')
            })
        return res

    @api.multi
    def unlink(self):
        for emp in self:
            workorder = self.env['mrp.workorder'].search([('operation_id', '=' , emp.operation_id.id), ('production_id', '=', emp.mrp_id.id)], limit=1)
            machine_assign_ids = self.env['machine.assigned.employee'].search([('assigned_id', '=' , emp.id)])
            if workorder.state in ['ready', 'pending']:
                machine_assign_ids.unlink()
            else:
                machine_assign_ids.write({'is_active': False})
        return super(AssignedEmployee, self).unlink()

    @api.onchange('operation_id')
    def _get_workcenter(self):
        machine = self.env['machine.management']
        if self.operation_id:
            # if self.mrp_id and self._origin.mrp_id:
            #     machine = self.env['machine.management'].search([('operation_id', '=', self.operation_id.id), ('mrp_production_id','=', self._origin.mrp_id.id)], limit=1)
            # self.machine_id = machine.id if machine else False
            mrp_routing_workcenter = self.env['mrp.routing.workcenter'].search([('id', '=', self.operation_id.id)], limit=1)
            if mrp_routing_workcenter and mrp_routing_workcenter.workcenter_id:
                self.workcenter_id = mrp_routing_workcenter.workcenter_id.id
            else:
                self.workcenter_id = self.operation_id.workcenter_id and self.operation_id.workcenter_id.id

            self.machine_id = False

            context = self._context
            if context.has_key('mrp_parent_id') and context.get('mrp_parent_id'):
                parent = context.get('mrp_parent_id')
                machines = machine.sudo().search([('operation_id', '=', self.operation_id.id), ('mrp_production_id', '=', parent)])
                if machines:
                    if len(machines) > 1:
                        self.machine_id = machines.ids[0]
                    else:
                        self.machine_id = machines.id


    # @api.onchange('workcenter_id')
    # def _get_operation(self):
    #     print '\n _get_operation called ', self
    #     if self.workcenter_id:
    #         mrp_routing_workcenter = self.env['mrp.routing.workcenter'].search([('workcenter_id', '=', self.workcenter_id.id)])
    #         print '\ mrp routing workorder', mrp_routing_workcenter
    #         self.operation_id = mrp_routing_workcenter.id
        # if self.mrp_id:
        #     mo_obj = self.env['assigned.employee'].search([('mrp_id', '=', self.mrp_id.id)])
        #     print '\n Mo OBJ', mo_obj

    # @api.model
    # def create(self, vals):
    #     print '\n create called',self,'\n vals',vals
    #
    #     res = super(AssignedEmployee, self).create(vals)
    #     print '\n res----->>',res
    #     mrp_id = vals['mrp_id']
    #     mrp_obj = self.env['mrp.production'].search([('id','=',mrp_id)])
    #     print '\n mrp_obj',mrp_obj
    #     assigned_employee_obj = mrp_obj.assinged_employee_ids
    #     print '\n assigned employee obj',assigned_employee_obj
    #     print '\n assigned employee obj len-------------+++++++++----->>',len(assigned_employee_obj)
    #     mrp_routing = mrp_obj.routing_id
    #     routing_lines = mrp_routing.operation_ids
    #     print '\n len of routing',len(routing_lines),'\n routing',routing_lines
        # if len(routing_lines) != len(assigned_employee_obj):
        #     raise UserError(_("You need to assign employees based on routing operations."))
        # return res

    # @api.multi
    # def write(self, vals):
    #     print '\n write called from AssignEmployee',self,'vals',vals
    #     res = super(AssignedEmployee, self).write(vals)
    #     return res
    # @api.onchange('workorder_id')
    # def _get_operation_id(self):
    #     print '\n _get_operation_id called',self


class HrEmployee(models.Model):
    _inherit = "hr.employee"
    _description = "Employee"

    # @api.model
    # def name_search(self, name, args=None, operator='ilike', limit=100):
    #     if args is None:
    #         args = []
    #     result = []
    #     assigned_emp_objs = self.env['assigned.employee'].search([('mrp_id.state', '!=', 'done'), ('unactive', '=', False)]).mapped(
    #         'employee_id')
    #     emp = self.search([('id', 'not in', assigned_emp_objs.ids)])
    #     for record in emp:
    #         result.append((record.id, record.name))
    #     return result

    @api.multi
    def attendance_action(self, next_action):
        """ Changes the attendance of the employee.
            Returns an action to the check in/out message,
            next_action defines which menu the check in/out message should return to. ("My Attendances" or "Kiosk Mode")
        """
        self.ensure_one()
        action_message = self.env.ref('hr_attendance.hr_attendance_action_greeting_message').read()[0]
        action_message['previous_attendance_change_date'] = self.last_attendance_id and (
                self.last_attendance_id.check_out or self.last_attendance_id.check_in) or False
        action_message['employee_name'] = self.name
        action_message['next_action'] = 'labor_manufacturing_view.labor_act_window'
        if self.user_id:
            modified_attendance = self.sudo(self.user_id.id).attendance_action_change()
        else:
            modified_attendance = self.sudo().attendance_action_change()
        action_message['attendance'] = modified_attendance.read()[0]
        employee_id = action_message['attendance']['employee_id'][0]
        employee_obj = self.env['hr.employee'].browse(employee_id)
        check_in = action_message['attendance']['check_in']
        check_out = action_message['attendance']['check_out']
        mrp_production_obj = self.env['mrp.production'].search([])
        assigned_emp_obj = self.env['assigned.employee'].search([('employee_id','=', employee_id)])
        # check_bool = False
        # for emp in assigned_emp_obj:
        #     if emp.employee_id.is_assign_emp==True:
        #         check_bool = True
        #         assigned_emp_obj = emp
        # if not check_bool:
        #     if assigned_emp_obj:
        #         assigned_emp_obj = assigned_emp_obj.sorted('id',reverse=True)[0]

        attendance_obj = self.env['hr.attendance'].search([('employee_id','=', employee_id),('check_in','=',check_in)])
        att_check_in = attendance_obj.check_in
        attendance_obj_co = self.env['hr.attendance'].search(
            [('employee_id', '=', employee_id), ('check_in', '=', check_in),('check_out','=',check_out)])
        att_check_out = attendance_obj_co.check_out
        labor_mrp_vals = {}
        my_pages_vals = {}
        mo_number = False
        for assigned_emp in assigned_emp_obj:
            product = assigned_emp.mrp_id.product_id and assigned_emp.mrp_id.product_id.id or False
            operation = assigned_emp.operation_id.id or False
            qty = assigned_emp.mrp_id.product_qty
            mo_number = assigned_emp.mrp_id.name
            bom = assigned_emp.mrp_id.bom_id and assigned_emp.mrp_id.bom_id.id or False
            res_list = []
            move_raw_ids = assigned_emp.mrp_id.move_raw_ids
            for move in move_raw_ids:
                res_list.append((0, 0, {'product_id': move.product_id.id, 'to_consume': move.product_uom_qty}))
            labor_mrp_vals['employee_id'] = employee_id
            labor_mrp_vals['image'] = employee_obj.image
            labor_mrp_vals['department_id'] = employee_obj.department_id and employee_obj.department_id.id or False
            labor_mrp_vals['job_id'] = employee_obj.job_id and employee_obj.job_id.id or False
            labor_mrp_vals['calendar_id'] = employee_obj.calendar_id and employee_obj.calendar_id.id or False
            labor_mrp_vals['check_in'] = check_in or False
            labor_mrp_vals['check_out'] = check_out or False
            labor_mrp_vals['mo_number'] = mo_number
            labor_mrp_vals['product_id'] = product
            labor_mrp_vals['qty'] = qty
            labor_mrp_vals['bom_id'] = bom
            labor_mrp_vals['operation_id'] = operation
            labor_mrp_vals['product_ids'] = res_list

            # labor_mrp_vals = {
            #     'employee_id': employee_id,
            #     'image': employee_obj.image,
            #     'department_id': employee_obj.department_id and employee_obj.department_id.id or False,
            #     'job_id': employee_obj.job_id and employee_obj.job_id.id or False,
            #     'calendar_id': employee_obj.calendar_id and employee_obj.calendar_id.id or False,
            #     'check_in': check_in or False,
            #     'check_out': check_out or False,
            #     'mo_number': mo_number,
            #     'product_id': product,
            #     'qty': qty,
            #     'bom_id': bom,
            #     'operation_id':operation,
            #     'product_ids': res_list,
            # }
            my_pages_vals['date'] = fields.Date.today()
            my_pages_vals['name'] = employee_obj.name
            my_pages_vals['department'] = employee_obj.department_id and employee_obj.department_id.id or False
            my_pages_vals['check_in'] = check_in or False
            my_pages_vals['check_out'] = check_out or False
            my_pages_vals['mo_no'] = assigned_emp.mrp_id.id
            my_pages_vals['operation'] = operation
            my_pages_vals['workcenter'] = assigned_emp.workcenter_id and assigned_emp.workcenter_id.id or False
            # my_pages_vals = {
            #                  'date':fields.Date.today(),
            #                  'name':employee_obj.name,
            #                  'department':employee_obj.department_id and employee_obj.department_id.id or False,
            #                  'check_in':check_in or False,
            #                 'check_out': check_out or False,
            #                 'mo_no':assigned_emp.mrp_id.id,
            #                 'operation':operation,
            #                 'workcenter':assigned_emp.workcenter_id and assigned_emp.workcenter_id.id or False
            #
            #                  }
        if att_check_in == check_in and check_out is False:
            for assigned_emp in assigned_emp_obj:
                if not assigned_emp.unactive:
                    # stop
                    labor_mrp = self.env['labor.mrp'].create(labor_mrp_vals)
                    my_page = self.env['my.pages'].create(my_pages_vals)
                    action_message['res_id'] = labor_mrp.id
                    return {'action': action_message, }
        if att_check_in == check_in and att_check_out == check_out:
            labor_mrp_current = self.env['labor.mrp'].search([('employee_id','=', employee_id), ('check_out','=', False), ('mo_number','=', mo_number),('check_in','=', check_in)])
            labor_write_obj = labor_mrp_current.write({'check_out': check_out})
            for assigned_emp in assigned_emp_obj:
                current_my_page = self.env['my.pages'].search([('name','=', employee_obj.name), ('check_out','=', False), ('mo_no','=', assigned_emp.mrp_id.id),('check_in','=', check_in)])
                current_my_page_obj = current_my_page.write({'check_out': check_out})
            if labor_mrp_current:
                action_message['res_id'] = labor_mrp_current.id
                return {'action': action_message, }
            if not labor_mrp_current:
                action_message['res_id'] = employee_id
                return {'action': action_message, }

        action_message['res_id'] = employee_id
        return {'action': action_message, }

class LaborMrp(models.Model):
    _name = "labor.mrp"
    _description = "managing Labor Manufacturing workers and machine"
    _rec_name = 'employee_id'

    employee_id = fields.Many2one('hr.employee', 'Name')
    image = fields.Binary("Photo", help="This field holds the image used as photo for the employee")
    department_id = fields.Many2one('hr.department', 'Department')
    job_id = fields.Many2one('hr.job', 'Role')
    mo_number = fields.Char('MO Number')
    product_id = fields.Many2one('product.product', 'Product')
    calendar_id = fields.Many2one('resource.calendar', 'Working Time')
    date = fields.Date('Date', default=fields.Date.context_today)
    check_in = fields.Datetime('Check In Time')
    check_out = fields.Datetime('Check Out Time')
    qty = fields.Float('Qty')
    bom_id = fields.Many2one('mrp.bom', 'Bill of Material')
    product_ids = fields.One2many('product.consume', 'labor_id')
    operation_id = fields.Many2one('mrp.routing.workcenter',string="Operation")

    def _build_contexts(self, data):
        result = {}
        return result

    @api.multi
    def print_pdf(self, data):
        self.ensure_one()
        data = {}
        data['ids'] = self.env.context.get('active_ids', [])
        data['model'] = self.env.context.get('active_model', 'ir.ui.menu')
        data['form'] = self.read(['employee_id','image','mo_number','department_id','job_id'])[0]
        used_context = self._build_contexts(data)
        data['form']['used_context'] = dict(used_context, lang=self.env.context.get('lang', 'en_US'))
        data['form'].update({'user': self.create_uid.name})
        return self.env['report'].get_action(self, 'labor_manufacturing_view.report_labor_profile', data=data)


class ProductConsume(models.Model):
    _name = "product.consume"

    labor_id = fields.Many2one('labor.mrp', 'Labor')
    product_id = fields.Many2one('product.product', 'Product')
    to_consume = fields.Float('To Consume')

class WorkEmployeeDepartment(models.Model):
    _name = 'work.employee.department'

    machine_id = fields.Many2one('machine.management', 'Machine')
    employee_id = fields.Many2one('hr.employee', 'Employee Name')
    department_id = fields.Many2one('hr.department', 'Department')
    start_date = fields.Datetime('Start Date')
    end_date = fields.Datetime('End Date')
    workorder_id = fields.Many2one('mrp.workorder', 'WorkOrder')

class MachineManagement(models.Model):
    _name = 'machine.management'
    _rec_name = 'mrp_production_id'

    @api.model
    def update_work(self, mo_active, emp_active, action):
        emp_department = self.env['employee.department']
        emp_work_department = self.env['employee.department']
        mm_obj = self.search([('id', '=', mo_active)], limit=1)
        workorder = self.env['mrp.workorder'].search([('operation_id', '=', mm_obj.operation_id.id),('workcenter_id', '=', mm_obj.workcenter_id.id), ('production_id', '=' , mm_obj.mrp_production_id.id)], limit=1)
        employee = self.env['hr.employee'].browse(emp_active)
        labour = self.env['labor.mrp'].search([('employee_id', '=', employee.id), ('mo_number', '=', workorder.production_id.name), ('check_in', '!=', False), ('check_out', '=', False)], order='id desc', limit=1)
        date = fields.Datetime.now()
        user_tz = self.env.user.tz or self.env.context.get('tz') or 'UTC'
        local = pytz.timezone(user_tz)
        date_local = datetime.strftime(pytz.utc.localize(datetime.strptime(date,
        DEFAULT_SERVER_DATETIME_FORMAT)).astimezone(local),"%Y-%m-%d %H:%M:%S")
        if workorder and labour and workorder.state not in ['done', 'cancel']:
            if action == 'start':
                emp_department = self.env['employee.department'].create({
                        'machine_id': mm_obj and mm_obj.id or False,
                        'employee_id': employee and employee.id or False,
                        'department_id': employee and employee.department_id.id or False,
                        'start_date': date_local,
                        'end_date': False,
                        'work_started' : True,
                    })
                if workorder.state == 'progress':
                    emp_work_department = self.env['work.employee.department'].create({
                            'machine_id': mm_obj and mm_obj.id or False,
                            'employee_id': employee and employee.id or False,
                            'department_id': employee and employee.department_id.id or False,
                            'start_date': date_local,
                            'end_date': False,
                            'workorder_id': workorder.id
                        })
            else:
                if not emp_work_department:
                    emp_work_department = self.env['work.employee.department'].search([('machine_id', '=', mm_obj.id), ('workorder_id','=', workorder.id),('end_date', '=', False), ('employee_id', '=', emp_active)], limit=1)
                if emp_work_department and action == 'stop'and workorder.state == 'progress':
                    emp_work_department.end_date = date_local
                if not emp_department:
                    emp_department = self.env['employee.department'].search([('machine_id', '=', mm_obj.id), ('end_date', '=', False), ('employee_id', '=', emp_active)], limit=1)
                if emp_department and action == 'stop':
                    emp_department.end_date = date_local
                    emp_department.work_started = False

        view_id = self.env.ref('labor_manufacturing_view.machine_management_tree_view').id
        context = self._context.copy()
        action = {
                    'name': _("Machine Management"),
                    'view_mode': 'form',
                    'res_id': mm_obj.id,
                    'res_model': 'machine.management',
                    'view_id': view_id,
                    'views': [(False, u'form')],
                    'type': 'ir.actions.act_window',
                    'target': 'current',
                    'context': context,
        }
        vals = {'action': action}
        return vals



    @api.multi
    def button_mark_start(self):
        timeline = self.env['mrp.workcenter.productivity']
        workorders = self.env['mrp.workorder'].search([('production_id','=',self.mrp_production_id.id),('workcenter_id','=',self.workcenter_id.id), ('id','=',self.workorder_id.id)])
        # for rec_emp in self.employee_ids:
        #     employee = self.env['employee.department'].search(
        #         [('employee_id', '=', rec_emp.employee_id.id),('machine_id','=',self.id)])
        if workorders.duration < workorders.duration_expected:
            loss_id = self.env['mrp.workcenter.productivity.loss'].search([('loss_type', '=', 'productive')], limit=1)
            if not len(loss_id):
                raise UserError(_(
                    "You need to define at least one productivity loss in the category 'Productivity'. Create one from the Manufacturing app, menu: Configuration / Productivity Losses."))
        else:
            loss_id = self.env['mrp.workcenter.productivity.loss'].search([('loss_type', '=', 'performance')], limit=1)
            if not len(loss_id):
                raise UserError(_(
                    "You need to define at least one productivity loss in the category 'Performance'. Create one from the Manufacturing app, menu: Configuration / Productivity Losses."))
        for workorder in workorders:
            if workorder.production_id.state != 'progress':
                workorder.production_id.write({
                    'state': 'progress',
                    'date_start': datetime.now(),
                })
                self.write({
                    'time': datetime.now(),
                    'start_date': datetime.now()
                })
                # for rec_emp in self.employee_ids:
                #     employee = self.env['employee.department'].search(
                #         [('employee_id', '=', rec_emp.employee_id.id),('machine_id','=',self.id)])
                #     employee.write({
                #         'start_date': datetime.now()
                #     })
            timeline.create({
                'workorder_id': workorder.id,
                'workcenter_id': workorder.workcenter_id.id,
                'description': _('Time Tracking: ') + self.env.user.name,
                'loss_id': loss_id[0].id,
                'date_start': datetime.now(),
                'user_id': self.env.user.id
            })
            start_time = workorder.time_ids
            start_list = []
            for start in start_time:
                start_list.append(start.date_start)
            start_min_time = min(start_list)
            self.write({
                'time': start_min_time,
                'start_date': start_min_time
            })
            # for rec_emp in self.employee_ids:
            #     employee = self.env['employee.department'].search(
            #         [('employee_id', '=', rec_emp.employee_id.id), ('machine_id', '=', self.id)])
            #     employee.write({
            #         'start_date': start_min_time
            #     })
        start_time = workorders.time_ids
        start_list = []
        for start in start_time:
            start_list.append(start.date_start)
        start_min_time = min(start_list) if start_list else False
        self.write({
            'state': 'progress',
            'time':start_min_time,
            'start_date': start_min_time
        })
        # for rec_emp in self.employee_ids:
        #     employee = self.env['employee.department'].search(
        #         [('employee_id', '=', rec_emp.employee_id.id), ('machine_id', '=', self.id)])
        #     employee.write({
        #         'start_date': start_min_time
        #     })
        self.is_user_working=True
        self.check=True
        return workorders.write({'state': 'progress',
                           'date_start': datetime.now(),
                           })

    @api.multi
    def button_mark_block(self):
        workorders = self.env['mrp.workorder'].search(
            [('production_id', '=', self.mrp_production_id.id), ('workcenter_id', '=', self.workcenter_id.id), ('id','=',self.workorder_id.id)])
        workorders.ensure_one()
        workorders.end_all()
        self.ensure_one()
        self.end_all()
        self.write({'state': 'done', 'end_date': fields.Datetime.now()})
        return workorders.write({'state': 'done', 'date_finished': fields.Datetime.now()})

    @api.multi
    def button_finish(self):
        workorders = self.env['mrp.workorder'].search(
            [('production_id', '=', self.mrp_production_id.id), ('workcenter_id', '=', self.workcenter_id.id), ('id','=',self.workorder_id.id)])
        self.ensure_one()
        self.end_all()
        workorders.ensure_one()
        workorders.end_all()
        workorders.write({'state': 'done','is_produced':True})
        current_employees = self.employee_ids
        if current_employees:
            for ce in current_employees:
                if ce:
                    if not ce.end_date:
                        ce.write({'end_date': fields.Datetime.now()})
                        ce.end_date = fields.Datetime.now()

        return self.write({'state': 'done', 'end_date': fields.Datetime.now()})

    @api.multi
    def button_mark_pause(self, doall=False):
        """
        @param: doall:  This will close all open time lines on the open work orders when doall = True, otherwise
        only the one of the current user
        """
        # TDE CLEANME
        #print '\n---->button_mark_pause', self

        workorders = self.env['mrp.workorder'].search(
            [('production_id', '=', self.mrp_production_id.id), ('workcenter_id', '=', self.workcenter_id.id), ('id','=',self.workorder_id.id)])
        #print'\n workorders', workorders

        #print 'employee',employee
        timeline_obj = self.env['mrp.workcenter.productivity']
        domain = [('workorder_id', 'in', workorders.ids), ('date_end', '=', False)]
        if not doall:
            domain.append(('user_id', '=', workorders.env.user.id))
        not_productive_timelines = timeline_obj.browse()
        for timeline in timeline_obj.search(domain, limit=None if doall else 1):
            wo = timeline.workorder_id
            if wo.duration_expected <= wo.duration:
                if timeline.loss_type == 'productive':
                    not_productive_timelines += timeline
                timeline.write({'date_end': fields.Datetime.now()})
                self.write({'end_date': fields.Datetime.now(),})
                # for rec_emp in self.employee_ids:
                #     employee = self.env['employee.department'].search(
                #         [('employee_id', '=', rec_emp.employee_id.id), ('machine_id', '=', self.id)])
                #     if employee:
                #         employee.write({'end_date': fields.Datetime.now()})
            else:
                maxdate = fields.Datetime.from_string(timeline.date_start) + relativedelta(
                    minutes=wo.duration_expected - wo.duration)
                enddate = datetime.now()
                if maxdate > enddate:
                    timeline.write({'date_end': enddate})
                    self.write({'end_date': enddate,
                                })
                    # for rec_emp in self.employee_ids:
                    #     employee = self.env['employee.department'].search(
                    #         [('employee_id', '=', rec_emp.employee_id.id), ('machine_id', '=', self.id)])
                    #     if employee:
                    #         employee.write({'end_date': enddate})
                else:
                    timeline.write({'date_end': maxdate})
                    self.write({'end_date': maxdate,})
                    # for rec_emp in self.employee_ids:
                    #     employee = self.env['employee.department'].search(
                    #         [('employee_id', '=', rec_emp.employee_id.id), ('machine_id', '=', self.id)])
                    #     if employee:
                    #         employee.write({'end_date': maxdate})
                    not_productive_timelines += timeline.copy({'date_start': maxdate, 'date_end': enddate})
        if not_productive_timelines:
            loss_id = self.env['mrp.workcenter.productivity.loss'].search([('loss_type', '=', 'performance')], limit=1)
            if not len(loss_id):
                raise UserError(_(
                    "You need to define at least one unactive productivity loss in the category 'Performance'. Create one from the Manufacturing app, menu: Configuration / Productivity Losses."))
            not_productive_timelines.write({'loss_id': loss_id.id})
        end_time = workorders.time_ids
        if end_time:
            end_list = []
            for end in end_time:
                if end.date_end:
                    end_list.append(end.date_end)
            if end_list:
                end_max_time = max(end_list)
                self.write({
                    'end_date': end_max_time,
                })
                # for rec_emp in self.employee_ids:
                #     employee = self.env['employee.department'].search(
                #         [('employee_id', '=', rec_emp.employee_id.id), ('machine_id', '=', self.id)])
                #     if employee:
                #         employee.write({'end_date': end_max_time})
        self.is_user_working=False
        self.check=False
        # self.is_produced=True
        return True

    @api.multi
    def end_all(self):
        return self.button_mark_pause(doall=True)

    # @api.multi
    # @api.depends('operation_id', 'mrp_production_id')
    # def name_get(self):
    #     result = []
    #     for machine in self:
    #         name = machine.operation_id.name + '/' + machine.mrp_production_id.name
    #         result.append((machine.id, name))
    #     return result

    @api.multi
    def button_pending(self):
        self.button_mark_pause()
        return True

    @api.multi
    def button_unblock(self):
        for order in self:
            order.workcenter_id.unblock()
        return True

    def _generate_lot_ids(self):
        """ Generate stock move lots """
        workorders = self.env['mrp.workorder'].search(
            [('production_id', '=', self.mrp_production_id.id), ('workcenter_id', '=', self.workcenter_id.id), ('id','=',self.workorder_id.id)])
        self.ensure_one()
        workorders.ensure_one()
        MoveLot = self.env['stock.move.lots']
        tracked_moves = workorders.move_raw_ids.filtered(
            lambda move: move.state not in ('done', 'cancel') and move.product_id.tracking != 'none' and move.product_id != workorders.production_id.product_id)
        for move in tracked_moves:
            qty = move.unit_factor * workorders.qty_producing
            if move.product_id.tracking == 'serial':
                while float_compare(qty, 0.0, precision_rounding=move.product_uom.rounding) > 0:
                    MoveLot.create({
                        'move_id': move.id,
                        'quantity': min(1, qty),
                        'quantity_done': min(1, qty),
                        'production_id': workorders.production_id.id,
                        'workorder_id': workorders.id,
                        'product_id': move.product_id.id,
                        'done_wo': False,
                    })
                    qty -= 1
            else:
                MoveLot.create({
                    'move_id': move.id,
                    'quantity': qty,
                    'quantity_done': qty,
                    'product_id': move.product_id.id,
                    'production_id': workorders.production_id.id,
                    'workorder_id': workorders.id,
                    'done_wo': False,
                    })

    @api.multi
    def record_production(self):
        workorders = self.env['mrp.workorder'].search(
            [('production_id', '=', self.mrp_production_id.id), ('workcenter_id', '=', self.workcenter_id.id), ('id','=',self.workorder_id.id)])
        self.ensure_one()
        workorders.ensure_one()
        for work in workorders:
            work.record_production()

        # if workorders.qty_producing <= 0:
        #     raise UserError(_('Please set the quantity you produced in the Current Qty field. It can not be 0!'))

        # if (workorders.production_id.product_id.tracking != 'none') and not workorders.final_lot_id:
        #     raise UserError(_('You should provide a lot for the final product'))

        # # Update quantities done on each raw material line
        # raw_moves = workorders.move_raw_ids.filtered(
        #     lambda x: (x.has_tracking == 'none') and (x.state not in ('done', 'cancel')) and x.bom_line_id)
        # for move in raw_moves:
        #     if move.unit_factor:
        #         rounding = move.product_uom.rounding
        #         move.quantity_done += float_round(workorders.qty_producing * move.unit_factor, precision_rounding=rounding)

        # # Transfer quantities from temporary to final move lots or make them final
        # for move_lot in workorders.active_move_lot_ids:
        #     # Check if move_lot already exists
        #     if move_lot.quantity_done <= 0:  # rounding...
        #         move_lot.sudo().unlink()
        #         continue
        #     if not move_lot.lot_id:
        #         raise UserError(_('You should provide a lot for a component'))
        #     # Search other move_lot where it could be added:
        #     lots = workorders.move_lot_ids.filtered(
        #         lambda x: (x.lot_id.id == move_lot.lot_id.id) and (not x.lot_produced_id) and (not x.done_move))
        #     if lots:
        #         lots[0].quantity_done += move_lot.quantity_done
        #         lots[0].lot_produced_id = workorders.final_lot_id.id
        #         move_lot.sudo().unlink()
        #     else:
        #         move_lot.lot_produced_id = workorders.final_lot_id.id
        #         move_lot.done_wo = True

        # # One a piece is produced, you can launch the next work order
        # if workorders.next_work_order_id.state == 'pending':
        #     workorders.next_work_order_id.state = 'ready'
        # if workorders.next_work_order_id and workorders.final_lot_id and not workorders.next_work_order_id.final_lot_id:
        #     workorders.next_work_order_id.final_lot_id = workorders.final_lot_id.id

        #     workorders.move_lot_ids.filtered(
        #     lambda move_lot: not move_lot.done_move and not move_lot.lot_produced_id and move_lot.quantity_done > 0
        # ).write({
        #     'lot_produced_id': workorders.final_lot_id.id,
        #     'lot_produced_qty': workorders.qty_producing
        # })

        # # If last work order, then post lots used
        # # TODO: should be same as checking if for every workorder something has been done?
        # if not workorders.next_work_order_id:
        #     production_move = workorders.production_id.move_finished_ids.filtered(
        #         lambda x: (x.product_id.id == workorders.production_id.product_id.id) and (x.state not in ('done', 'cancel')))
        #     if production_move.product_id.tracking != 'none':
        #         move_lot = production_move.move_lot_ids.filtered(lambda x: x.lot_id.id == workorders.final_lot_id.id)
        #         if move_lot:
        #             move_lot.quantity += workorders.qty_producing
        #         else:
        #             move_lot.create({'move_id': production_move.id,
        #                              'lot_id': workorders.final_lot_id.id,
        #                              'quantity': workorders.qty_producing,
        #                              'quantity_done': workorders.qty_producing,
        #                              'workorder_id': workorders.id,
        #                              })
        #     else:
        #         production_move.quantity_done += workorders.qty_producing  # TODO: UoM conversion?
        # # Update workorder quantity produced
        # workorders.qty_produced += workorders.qty_producing

        # # Set a qty producing
        # if workorders.qty_produced >= workorders.production_id.product_qty:
        #     workorders.qty_producing = 0
        # elif workorders.production_id.product_id.tracking == 'serial':
        #     workorders.qty_producing = 1.0
        #     workorders._generate_lot_ids()
        # else:
        #     workorders.qty_producing = workorders.production_id.product_qty - workorders.qty_produced
        #     workorders._generate_lot_ids()

        # workorders.final_lot_id = False
        # if workorders.qty_produced >= workorders.production_id.product_qty:
        #     workorders.button_finish()
        #     self.button_finish()
        return True

    check = fields.Boolean(string="check", default=False)
    workcenter_id = fields.Many2one('mrp.workcenter', 'Work Center', required=False,
        states={'done': [('readonly', True)], 'cancel': [('readonly', True)]})
    working_state = fields.Selection(
        'Workcenter Status', related='workcenter_id.working_state',
        help='Technical: used in views only')
    is_user_working = fields.Boolean(
        'Is Current User Working',
        help="Technical field indicating whether the current user is working. ")#compute='_compute_is_user_working',
    production_state = fields.Selection(
        'Production State', readonly=True,
        related='mrp_production_id.state',
        help='Technical: used in views only.')
    is_produced = fields.Boolean('is produced')#compute='_compute_is_produced'
    qty_produced = fields.Float(
        'Quantity', default=0.0,
        readonly=True,
        digits=dp.get_precision('Product Unit of Measure'),
        help="The number of products already handled by this work order")

    product_id = fields.Many2one('product.product', 'Product')
    mrp_production_id = fields.Many2one('mrp.production', 'MO Number', required=True,
        index=True, ondelete='cascade', track_visibility='onchange',
        states={'done': [('readonly', True)], 'cancel': [('readonly', True)]})

    mrp_plan_id = fields.Many2one('mrp.plan', 'MP Name')
    bom_id = fields.Many2one('mrp.bom', 'Bill of Material')
    time = fields.Char('Time', readonly=True)
    start_date = fields.Char('Start Date', readonly=True)
    end_date = fields.Char('End Date', readonly=True)
    employee_ids = fields.One2many('employee.department', 'machine_id')
    assigned_emp_ids = fields.One2many('machine.assigned.employee', 'machine_id')
    state = fields.Selection([
        ('pending', 'Pending'),
        ('ready', 'Ready'),
        ('progress', 'In Progress'),
        ('done', 'Finished'),
        ('cancel', 'Cancelled')], string='Status',
        default='pending')
    workorder_id = fields.Many2one('mrp.workorder', 'Workorder',)
    operation_id = fields.Many2one('mrp.routing.workcenter',string="Operation")

    # @api.one
    # @api.depends('mrp_production_id.product_qty', 'qty_produced')
    # def _compute_is_produced(self):
    #     self.is_produced = self.qty_produced >= self.mrp_production_id.product_qty

    # def _compute_is_user_working(self):
    #     """ Checks whether the current user is working """
        # workorders = self.env['mrp.workorder']
            #.search(('production_id', '=', self.mrp_production_id.id), ('workcenter_id', '=', self.workcenter_id.id)])
        # for order in workorders:
        #     if order.time_ids.filtered(lambda x: (x.user_id.id == self.env.user.id) and (not x.date_end) and (x.loss_type in ('productive', 'performance'))):
        #         order.is_user_working = True
        #     else:
        #         order.is_user_working = False
        # for order in self:
        #     order.is_user_working = True


class EmployeeDepartment(models.Model):
    _name = 'employee.department'

    machine_id = fields.Many2one('machine.management', 'Machine')
    employee_id = fields.Many2one('hr.employee', 'Employee Name', readonly=True)
    department_id = fields.Many2one('hr.department', 'Department', readonly=True)
    start_date = fields.Char('Start Date', readonly=True)
    end_date = fields.Char('End Date', readonly=True)
    work_started = fields.Boolean('Work Started')

class StockMove(models.Model):
    _inherit = 'stock.move'

    wasted_qty = fields.Float('Wasted')
    scrap_qty = fields.Float('Scraped')


class MrpProduction(models.Model):
    _inherit = 'mrp.production'

    # @api.multi
    # def write(self,vals):
    #     res= super(MrpProduction,self).write(vals)
    #     assigned_employee_obj = self.assinged_employee_ids
    #     if assigned_employee_obj:
    #         for assign_emp in assigned_employee_obj:
    #             operation = self.assinged_employee_ids.search([('operation_id','=',assign_emp.operation_id.id), ('mrp_id','=',self.id)])
                # if len(operation) > 1:
                #     raise UserError(_("Operation must be unique, as per Routing."))
                # employee = self.assinged_employee_ids.search([('employee_id','=',assign_emp.employee_id.id),('mrp_id','=',self.id)])
                # if len(employee) > 1:
                #     raise UserError(_("Employee must be unique."))
            # mrp_routing = self.routing_id
            # routing_lines = mrp_routing.operation_ids
            # if len(routing_lines) != len(assigned_employee_obj):
            #     raise UserError(_("You need to assign employees based on Routing Operations Lines."))

        # return res

    # @api.model
    # def create(self, vals):
    #     res = super(MrpProduction, self).create(vals)
    #     return res

    @api.multi
    def button_plan(self):
        res = super(MrpProduction, self).button_plan()
        for rec in self.assinged_employee_ids:
            vals = {}
            vals['date'] = fields.Date.today()
            vals['mrp_production_id'] = rec.mrp_id and rec.mrp_id.id or False
            vals['name'] = rec.employee_id and rec.employee_id.id or False
            vals['project_id'] = rec.project_id and rec.project_id.id or False
            vals['operation_id'] = rec.operation_id and rec.operation_id.id or False
            vals['workcenter_id'] = rec.workcenter_id and rec.workcenter_id.id or False
            vals['status_boolean'] = rec.unactive
            vals['department_id'] = rec.department_id and rec.department_id.id or False
            vals['job_id'] = rec.job_id and rec.job_id.id or False
            vals['calendar_id'] = rec.calendar_id and rec.calendar_id.id or False
            vals['total_working_hour'] = rec.total_working_hour
            self.env['assign.employee'].create(vals)
        return res

    @api.multi
    def _workorders_create(self, bom, bom_data):
        """
        :param bom: in case of recursive boms: we could create work orders for child
                    BoMs
        """
        machine_management = self.env['machine.management']
        workorders = self.env['mrp.workorder']
        bom_qty = bom_data['qty']
        mrp_order_obj = self.env['mrp.order'].search([('mrp_production_id','=',self.id)])
        #print '\n mrp order obj',mrp_order_obj
        mrp_plan = mrp_order_obj.mrp_plan_id
        #print '\n mrp plan',mrp_plan

        # Initial qty producing
        if self.product_id.tracking == 'serial':
            quantity = 1.0
        else:
            quantity = self.product_qty - sum(self.move_finished_ids.mapped('quantity_done'))
            quantity = quantity if (quantity > 0) else 0

        for operation in bom.routing_id.operation_ids:
            # create workorder
            cycle_number = math.ceil(bom_qty / operation.workcenter_id.capacity)  # TODO: float_round UP
            duration_expected = (operation.workcenter_id.time_start +
                                 operation.workcenter_id.time_stop +
                                 cycle_number * operation.time_cycle * 100.0 / operation.workcenter_id.time_efficiency)
            
            res_list = []
            workorder = workorders.create({
                'name': operation.name,
                'production_id': self.id,
                'workcenter_id': operation.workcenter_id.id,
                'operation_id': operation.id,
                'duration_expected': duration_expected,
                'state': len(workorders) == 0 and 'ready' or 'pending',
                'qty_producing': quantity,
                'capacity': operation.workcenter_id.capacity,

            })
            machine_mgt = machine_management.create({
                'workcenter_id': operation.workcenter_id and operation.workcenter_id.id or False,
                'product_id' : self.product_id and self.product_id.id or False,
                'mrp_production_id':self and self.id or False,
                'bom_id':self.bom_id and self.bom_id.id or False,
                'mrp_plan_id': mrp_plan and mrp_plan.id or False,
                'state': len(workorders) == 0 and 'ready' or 'pending',
                'workorder_id': workorder.id,
                'operation_id':operation.id or False
            })
            for assign_emp in self.assinged_employee_ids:
                if assign_emp.operation_id.id == operation.id:
                    workorder.update({'emp_id': assign_emp.employee_id and assign_emp.employee_id.id or False,
                                    'assign_emp_id': assign_emp and assign_emp.id or False})
                    self.env['machine.assigned.employee'].create({
                            'employee_id': assign_emp.employee_id and assign_emp.employee_id.id or False,
                            'is_active': True,
                            'assigned_id': assign_emp.id,
                            'machine_id' : machine_mgt.id,
                    })
            if workorders:
                workorders[-1].next_work_order_id = workorder.id
            workorders += workorder

            # assign moves; last operation receive all unassigned moves (which case ?)
            moves_raw = self.move_raw_ids.filtered(lambda move: move.operation_id == operation)
            if len(workorders) == len(bom.routing_id.operation_ids):
                moves_raw |= self.move_raw_ids.filtered(lambda move: not move.operation_id)
            moves_finished = self.move_finished_ids.filtered(lambda move: move.operation_id == operation) #TODO: code does nothing, unless maybe by_products?
            moves_raw.mapped('move_lot_ids').write({'workorder_id': workorder.id})
            (moves_finished + moves_raw).write({'workorder_id': workorder.id})

            workorder._generate_lot_ids()
        # res_list = []

        # assinged_employee_ids = self.assinged_employee_ids
        # for assign_emp in assinged_employee_ids:
        #     if assign_emp.operation_id.id == operation.id:
        #         res_list.append((0, 0, {'employee_id': assign_emp.employee_id and assign_emp.employee_id.id or False,
        #                                 'department_id': assign_emp.department_id and assign_emp.department_id.id or False}))
        # for assign_emp in assinged_employee_ids:
        #     machine_mgt = machine_management.create({
        #         'workcenter_id': assign_emp.workcenter_id and assign_emp.workcenter_id.id or False,
        #         'product_id': self.product_id and self.product_id.id or False,
        #         'mrp_production_id': self and self.id or False,
        #         'bom_id': self.bom_id and self.bom_id.id or False,
        #         'mrp_plan_id': mrp_plan and mrp_plan.id or False,
        #         'state': len(workorders) == 0 and 'ready' or 'pending',
        #         'employee_ids': res_list,
        #         'workorder_id': workorder.id,
        #         'operation_id': assign_emp.operation_id.id or False
        #     })
        return workorders


    move_raw_ids = fields.One2many(
        'stock.move', 'raw_material_production_id', 'Raw Materials', oldname='move_lines',
        copy=False, states={'cancel': [('readonly', True)]},
        domain=[('scrapped', '=', False)])
    
    mo_done_time = fields.Datetime('Mo Done Time')
    
    @api.multi
    def button_mark_done(self):
        self.mo_done_time=fields.Datetime.now()
        # if self.assinged_employee_ids:
        #     for emp in self.assinged_employee_ids:
        #         emp.employee_id.write({'is_assign_emp':False})
        result = super(MrpProduction,self).button_mark_done()
        assinged_employee_ids = self.assinged_employee_ids
        for assign_emp in assinged_employee_ids:
            if not assign_emp.unactive:
                assign_emp.unactive = True
        return result


class MrpWorkorder(models.Model):
    _inherit = 'mrp.workorder'

    assign_emp_id = fields.Many2one('assigned.employee', 'Assigned Employee Id')
    emp_id = fields.Many2one('hr.employee', 'Employee')
    employee_dept_ids = fields.One2many('work.employee.department', 'workorder_id', 'Assigned Employee')

    @api.multi
    def button_start(self):
        # Copy from work order expansion
        if self.is_sequence == True:
            work_order = self.search([('production_id', '=', self.production_id.id), ('is_sequence', '=', True),
                                      ('sequence_run', '<', self.sequence_run), ('state', 'in', ['pending', 'ready'])])
            if work_order:
                raise UserError(_("Can't Start Working this Order"))

        # TDE CLEANME
        timeline = self.env['mrp.workcenter.productivity']
        machine_mgt_obj = self.env['machine.management'].search([('mrp_production_id','=',self.production_id.id),('workcenter_id','=',self.workcenter_id.id),('workorder_id','=',self.id)])
        if self.duration < self.duration_expected:
            loss_id = self.env['mrp.workcenter.productivity.loss'].search([('loss_type', '=', 'productive')], limit=1)
            if not len(loss_id):
                raise UserError(_(
                    "You need to define at least one productivity loss in the category 'Productivity'. Create one from the Manufacturing app, menu: Configuration / Productivity Losses."))
        else:
            loss_id = self.env['mrp.workcenter.productivity.loss'].search([('loss_type', '=', 'performance')], limit=1)
            if not len(loss_id):
                raise UserError(_(
                    "You need to define at least one productivity loss in the category 'Performance'. Create one from the Manufacturing app, menu: Configuration / Productivity Losses."))
        for workorder in self:
            if workorder.production_id.state != 'progress':
                workorder.production_id.write({
                    'state': 'progress',
                    'date_start': datetime.now(),
                })
                machine_mgt_obj.write({
                    'time': datetime.now(),
                    'start_date': datetime.now(),
                })
            timeline.create({
                'workorder_id': workorder.id,
                'workcenter_id': workorder.workcenter_id.id,
                'description': _('Time Tracking: ') + self.env.user.name,
                'loss_id': loss_id[0].id,
                'date_start': datetime.now(),
                'user_id': self.env.user.id
            })
            start_time = self.time_ids
            check_in_time = 0
            start_list = []
            attendance_ids = workorder.mapped('workcenter_id').mapped('calendar_id').mapped('attendance_ids')
            hour_ids = attendance_ids.mapped('hour_from')
            if hour_ids:
                check_in_time = hour_ids[0]
            # write dates in assigned emp
            user_tz = self.env.user.tz or self.env.context.get('tz') or 'UTC'
            local = pytz.timezone(user_tz)
            start_local = datetime.strftime(pytz.utc.localize(datetime.strptime(fields.Datetime.now(),
                DEFAULT_SERVER_DATETIME_FORMAT)).astimezone(local),"%Y-%m-%d %H:%M:%S")
            emp_todo_ids = workorder.mapped('employee_dept_ids')
            if start_local:
                for emp in machine_mgt_obj.mapped('employee_ids'):
                    if workorder.state in ['ready', 'pending'] and emp.start_date:
                        wo_start_time = datetime.strptime(emp.start_date, "%Y-%m-%d %H:%M:%S").strftime("%H")
                        if wo_start_time and check_in_time > 0 and check_in_time < wo_start_time:
                            emp_todo_ids.filtered(lambda x:x.employee_id == emp.employee_id).write({'start_date': start_local})
                for emp in emp_todo_ids.mapped('employee_id'):
                    labour = self.env['labor.mrp'].search([('employee_id', '=', emp.id), ('mo_number', '=', workorder.production_id.name),('check_in', '!=', False),('check_out', '=', False)], order='id desc', limit=1)
                    if labour and workorder.state not in ['ready', 'pending']:
                        self.env['work.employee.department'].create({
                                'start_date': start_local, 
                                'workorder_id': workorder.id,
                                'employee_id': emp.id,
                                'department_id': emp.department_id.id, 
                                'end_date': False
                        })
            for start in start_time:
                start_list.append(start.date_start)
            start_min_time = min(start_list)
            machine_mgt_obj.write({
                'start_date': start_min_time,
            })

        start_time = self.time_ids
        start_list = []
        for start in start_time:
            start_list.append(start.date_start)
        start_min_time = min(start_list)
        machine_mgt_obj.write({
            'start_date': start_min_time,
            'state': 'progress',
            'is_user_working': True,
            'check': True,
        })
        return self.write({'state': 'progress','date_start': datetime.now()})

    @api.multi
    def button_finish(self):
        if self.env.context.get('partial'):
            self.ensure_one()
            self.with_context(partial=True).end_all()
        else:
            user_tz = self.env.user.tz or self.env.context.get('tz') or 'UTC'
            local = pytz.timezone(user_tz)
            end_local = datetime.strftime(pytz.utc.localize(datetime.strptime(fields.Datetime.now(),
                DEFAULT_SERVER_DATETIME_FORMAT)).astimezone(local),"%Y-%m-%d %H:%M:%S")
            self.mapped('employee_dept_ids').filtered(lambda x: not x.end_date).write({'end_date': end_local})
            machine_management_obj = self.env['machine.management'].search(
                [('mrp_production_id', '=', self.production_id.id), ('workcenter_id', '=', self.workcenter_id.id),('workorder_id','=',self.id)])
            if machine_management_obj:
                todo_machine_ids = machine_management_obj.employee_ids.filtered(lambda x: not x.end_date)
                if todo_machine_ids:
                    todo_machine_ids.write({'end_date': end_local, 'work_started': False})
            self.ensure_one()
            self.end_all()
            machine_management_obj.ensure_one()
            machine_management_obj.end_all()
            machine_management_obj.write({'state': 'done','is_produced':True, 'end_date': fields.Datetime.now()})
            return self.write({'state': 'done', 'date_finished': fields.Datetime.now()})

    @api.multi
    def end_previous(self, doall=False):
        """
        @param: doall:  This will close all open time lines on the open work orders when doall = True, otherwise
        only the one of the current user
        """
        # TDE CLEANME
        for rec in self:
            machine_management_obj = self.env['machine.management'].search(
                [('mrp_production_id', '=', rec.production_id.id), ('workcenter_id', '=', rec.workcenter_id.id),('workorder_id','=', rec.id)])
            timeline_obj = self.env['mrp.workcenter.productivity']
            domain = [('workorder_id', 'in', rec.ids), ('date_end', '=', False)]
            if not doall:
                domain.append(('user_id', '=', rec.env.user.id))
            not_productive_timelines = timeline_obj.browse()
            for timeline in timeline_obj.search(domain, limit=None if doall else 1):
                wo = timeline.workorder_id
                if wo.duration_expected <= wo.duration:
                    if timeline.loss_type == 'productive':
                        not_productive_timelines += timeline
                    timeline.write({'date_end': fields.Datetime.now()})
                    machine_management_obj.write({'end_date': fields.Datetime.now()})
                else:
                    maxdate = fields.Datetime.from_string(timeline.date_start) + relativedelta(minutes=wo.duration_expected - wo.duration)
                    enddate = datetime.now()
                    if maxdate > enddate:
                        timeline.write({'date_end': enddate})
                        machine_management_obj.write({'end_date': enddate})
                    else:
                        timeline.write({'date_end': maxdate})
                        machine_management_obj.write({'end_date': maxdate})
                        not_productive_timelines += timeline.copy({'date_start': maxdate, 'date_end': enddate})
            if not self.env.context.get('partial'):
                if not_productive_timelines:
                    loss_id = self.env['mrp.workcenter.productivity.loss'].search([('loss_type', '=', 'performance')], limit=1)
                    if not len(loss_id):
                        raise UserError(_("You need to define at least one unactive productivity loss in the category 'Performance'. Create one from the Manufacturing app, menu: Configuration / Productivity Losses."))
                    not_productive_timelines.write({'loss_id': loss_id.id})
                end_list = []
                for end in rec.time_ids.filtered(lambda x:x.date_end):
                    end_list.append(end.date_end)
                if end_list:
                    end_max_time = max(end_list)
                    machine_management_obj.write({'end_date': end_max_time})
                machine_management_obj.write({'is_user_working': False,'check': False})
        return True

    @api.multi
    def end_all(self):
        if self.env.context.get('partial'):
            return self.with_context(partial=True).end_previous(doall=True)
        else:
            return self.end_previous(doall=True)

    @api.multi
    def button_pending(self):
        self.end_previous()
        return True

    @api.multi
    def button_unblock(self):
        for order in self:
            order.workcenter_id.unblock()
        return True

    def _generate_lot_ids(self):
        """ Generate stock move lots """
        self.ensure_one()
        MoveLot = self.env['stock.move.lots']
        tracked_moves = self.move_raw_ids.filtered(
            lambda move: move.state not in ('done', 'cancel') and move.product_id.tracking != 'none' and move.product_id != self.production_id.product_id)
        for move in tracked_moves:
            qty = move.unit_factor * self.qty_producing
            if move.product_id.tracking == 'serial':
                while float_compare(qty, 0.0, precision_rounding=move.product_uom.rounding) > 0:
                    MoveLot.create({
                        'move_id': move.id,
                        'quantity': min(1, qty),
                        'quantity_done': min(1, qty),
                        'production_id': self.production_id.id,
                        'workorder_id': self.id,
                        'product_id': move.product_id.id,
                        'done_wo': False,
                    })
                    qty -= 1
            else:
                MoveLot.create({
                    'move_id': move.id,
                    'quantity': qty,
                    'quantity_done': qty,
                    'product_id': move.product_id.id,
                    'production_id': self.production_id.id,
                    'workorder_id': self.id,
                    'done_wo': False,
                    })

    @api.multi
    def record_production(self):
        machine_management_obj = self.env['machine.management'].search(
            [('mrp_production_id', '=', self.production_id.id), ('workcenter_id', '=', self.workcenter_id.id), ('workorder_id','=', self.id)])
        self.ensure_one()
        if self.qty_producing <= 0:
            raise UserError(_('Please set the quantity you produced in the Current Qty field. It can not be 0!'))

        # if (self.production_id.product_id.tracking != 'none') and not self.final_lot_id:
        #     raise UserError(_('You should provide a lot for the final product'))

        # Update quantities done on each raw material line
        raw_moves = self.move_raw_ids.filtered(
            lambda x: (x.has_tracking == 'none') and (x.state not in ('done', 'cancel')) and x.bom_line_id)
        for move in raw_moves:
            if move.unit_factor:
                rounding = move.product_uom.rounding
                # move.quantity_done += float_round(self.qty_producing * move.unit_factor, precision_rounding=rounding)
                move.quantity_done = 0
        # Transfer quantities from temporary to final move lots or make them final
        for move_lot in self.active_move_lot_ids:
            # Check if move_lot already exists
            if move_lot.quantity_done <= 0:  # rounding...
                move_lot.sudo().unlink()
                continue
            if not move_lot.lot_id:
                raise UserError(_('You should provide a lot for a component'))
            # Search other move_lot where it could be added:
            lots = self.move_lot_ids.filtered(
                lambda x: (x.lot_id.id == move_lot.lot_id.id) and (not x.lot_produced_id) and (not x.done_move))
            if lots:
                lots[0].quantity_done += move_lot.quantity_done
                lots[0].lot_produced_id = self.final_lot_id.id
                move_lot.sudo().unlink()
            else:
                move_lot.lot_produced_id = self.final_lot_id.id
                move_lot.done_wo = True

        # One a piece is produced, you can launch the next work order
        if self.next_work_order_id.state == 'pending':
            self.next_work_order_id.state = 'ready'
        if self.next_work_order_id and self.final_lot_id and not self.next_work_order_id.final_lot_id:
            self.next_work_order_id.final_lot_id = self.final_lot_id.id

        self.move_lot_ids.filtered(
            lambda move_lot: not move_lot.done_move and not move_lot.lot_produced_id and move_lot.quantity_done > 0
        ).write({
            'lot_produced_id': self.final_lot_id.id,
            'lot_produced_qty': self.qty_producing
        })

        # If last work order, then post lots used
        # TODO: should be same as checking if for every workorder something has been done?
        consumed_rec = self.env['mrp.material.consumed'].search([('workorder_id', '=', self.id)], order='id desc', limit=1)
        if consumed_rec:
            self.qty_producing = float(consumed_rec.finished_goods)
        if not self.next_work_order_id:
            production_move = self.production_id.move_finished_ids.filtered(
                lambda x: (x.product_id.id == self.production_id.product_id.id) and (x.state not in ('done', 'cancel')))
            for production_move_rec in production_move:
                if production_move_rec.product_id.tracking != 'none':
                    move_lot = production_move_rec.move_lot_ids.filtered(lambda x: x.lot_id.id == self.final_lot_id.id)
                    if move_lot:
                        move_lot.quantity += self.qty_producing
                    else:
                        move_lot.create({'move_id': production_move_rec.id,
                                         'lot_id': self.final_lot_id.id,
                                         'quantity': self.qty_producing,
                                         'quantity_done': self.qty_producing,
                                         'workorder_id': self.id,
                                         })

                else:
                    production_move_rec.quantity_done += self.qty_producing  # TODO: UoM conversion?
            ###TODO:rrr end
        # Update workorder quantity produced
        self.qty_produced += self.qty_producing

        # Set a qty producing
        if self.qty_produced >= self.production_id.product_qty:
            self.qty_producing = 0
        elif self.production_id.product_id.tracking == 'serial':
            self.qty_producing = 1.0
            self._generate_lot_ids()
        else:
            self.qty_producing = self.production_id.product_qty - self.qty_produced
            self._generate_lot_ids()

        self.final_lot_id = False
        if self.qty_produced >= self.production_id.product_qty:
            self.button_finish()
            if machine_management_obj:
                machine_management_obj.button_finish()
        else:
            self.with_context(partial=True).button_finish()
        return True


class MrpWorkcenterProductivity(models.Model):
    _name = "mrp.workcenter.productivity"
    _description = "Workcenter Productivity Log"
    _order = "id desc"
    _rec_name = "loss_id"

    workcenter_id = fields.Many2one('mrp.workcenter', "Work Center", required=True)
    workorder_id = fields.Many2one('mrp.workorder', 'Work Order')
    user_id = fields.Many2one(
        'res.users', "User",
        default=lambda self: self.env.uid)
    loss_id = fields.Many2one(
        'mrp.workcenter.productivity.loss', "Loss Reason",
        ondelete='restrict', required=True)
    loss_type = fields.Selection(
        "Effectiveness", related='loss_id.loss_type', store=True)
    description = fields.Text('Description')
    partial = fields.Boolean('Partial')
    date_start = fields.Datetime('Start Date', default=fields.Datetime.now, required=True)
    date_end = fields.Datetime('End Date')
    duration = fields.Float('Duration', compute='_compute_duration', store=True)

    @api.depends('date_end', 'date_start')
    def _compute_duration(self):
        for blocktime in self:
            if blocktime.date_end:
                diff = fields.Datetime.from_string(blocktime.date_end) - fields.Datetime.from_string(blocktime.date_start)
                blocktime.duration = round(diff.total_seconds() / 60.0, 2)
            else:
                blocktime.duration = 0.0

    @api.multi
    def button_block(self):
        self.ensure_one()
        self.workcenter_id.order_ids.end_all()
        return {'type': 'ir.actions.client', 'tag': 'reload'}

