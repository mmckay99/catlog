from __future__ import unicode_literals

from django.db import models
from django.contrib.sites.models import Site

class CatlogTableCurrentId(models.Model):
    # We can only have one CatlogTableCurrentIds per site.
    current_id = models.BigIntegerField()
    site = models.OneToOneField(Site, on_delete=models.CASCADE)

class CatlogTable(models.Model):
    name = models.CharField(max_length = 128, unique = True)

    def __unicode__(self):
        return str(self.name).decode("utf-8")

class CatlogRow(models.Model):
    table = models.ForeignKey('CatlogTable', on_delete = models.CASCADE)
    rowId = models.IntegerField(default = 0)
    name = models.CharField(max_length = 128, unique = False)
    count = models.IntegerField(default = 0)
    description = models.TextField(null = False)

    def __unicode__(self):
        return (u"table " + unicode(self.table) + u" row " + str(self.rowId).decode("utf-8"))