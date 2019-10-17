# -*- coding: utf-8 -*-
{
    'name': 'Full POS Promotion',
    'version': '1.0',
    'category': 'Point Of Sale',
    'author': 'Hashmicro/GYB IT SOLUTIONS-Anand',
    'description': """
    To create new Discount type promotions
    """,
    'website': 'www.hashmicro.com',
    'depends': [
        'pos_promotion',
        'product_brand',
        'branch',
        'base',
        'point_of_sale'
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/pos_program_modifier.xml',
        'views/product.xml',
        'views/product_brand.xml',
        'views/full_pos_promotion_templates.xml',
        'views/customer_otp_data.xml',
        'views/branch_view.xml',
    ],
    'demo': [
    ],
    'qweb': ['static/src/xml/*.xml'],
    'installable': True,
    'application': True,
    'auto_install': False,
}
