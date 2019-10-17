# -*- coding: utf-8 -*-
{
    "name": "Labor Manufacturing View",
    "author": "HashMicro/ GYBITSolutions / Anand / Maulik (Braincrew Apps)",
    "version": "10.0.1.0",
    "website": "www.hashmicro.com",
    "description": "To create new module for managing Labor Manufacturing workers and machine",
    "category": "Manufacturing",
    "depends": ["mrp", "manufacturing_plan", "hr_timesheet", "hr_attendance","manufacturing_order_assigend_employee", "report", "stock"],
    "data": [
        'security/labour_security.xml',
        'security/ir.model.access.csv',
        'wizard/mrp_workcenter_block_view.xml',
        'report/report_manufacturing_orders_menu.xml',
        'report/report_manufacturing_orders_template.xml',
        'views/web_assest_backend_labor_template.xml',
        'views/labor_mrp_view.xml',
        'views/hr_employee.xml',
        'views/labor_pages_view.xml'
    ],
    'demo': [
    ],
'qweb': [
        "static/src/xml/machine_management.xml",
    ],
    "installable": True,
    'application': True,
}
