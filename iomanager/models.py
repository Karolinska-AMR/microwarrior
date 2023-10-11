from django.db import models

class File(models.Model):
    existingPath = models.CharField(max_length=250)
    sample = models.CharField(max_length=100)
    collection_date = models.CharField(max_length=8)
    ticket = models.CharField(max_length=20)
    eof = models.BooleanField()
