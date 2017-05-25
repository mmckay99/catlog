from __future__ import unicode_literals

from django.db import models
from django.contrib.sites.models import Site

class CatlogTableCurrentId(models.Model):
    # We can only have one CatlogTableCurrentIds per site.
    current_id = models.BigIntegerField()
    site = models.OneToOneField(Site)

class CatlogTable(models.Model):
    name = models.CharField(max_length = 128, unique = True)

class CatlogRow(models.Model):
    table = models.ForeignKey('CatlogTable', on_delete = models.CASCADE)
    rowId = models.IntegerField(default = 0)
    name = models.CharField(max_length = 128, unique = False)
    count = models.IntegerField(default = 0)
    description = models.TextField(null = False)

    def __unicode__(self):
        return (u"table " + self.table + u" row " + str(self.rowId).decode("utf-8"))