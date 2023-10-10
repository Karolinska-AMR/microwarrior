from django.db import models


class File(models.Model):
    existingPath = models.CharField(max_length=250)
    name = models.CharField(max_length=50)
    eof = models.BooleanField()
