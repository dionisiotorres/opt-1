from random import choice
from string import digits

from odoo import api, fields, models, _, exceptions


class HrEmployee(models.Model):
    _inherit = "hr.employee"

    def _default_random_pause(self):
        return ("".join(choice(digits) for i in range(5)))

    def _default_random_block(self):
        return ("".join(choice(digits) for i in range(5)))

    pause = fields.Char('Pause', default=_default_random_pause, copy=False)
    block = fields.Char('Block', default=_default_random_block, copy=False, )

    _sql_constraints = [('pause_uniq', 'unique (pause)',
                         "The Pause must be unique, this one is already assigned to another employee."),('block_uniq', 'unique (block)',
                         "The Block must be unique, this one is already assigned to another employee.")]

    @api.constrains('pause')
    def _verify_pause(self):
        for employee in self:
            if employee.pause and not employee.pause.isdigit():
                raise exceptions.ValidationError(_("The Pause must be a sequence of digits."))

    @api.constrains('block')
    def _verify_block(self):
        for employee in self:
            if employee.block and not employee.block.isdigit():
                raise exceptions.ValidationError(_("The Block must be a sequence of digits."))
