from django.db import models
from flowrunner.models import Task


# Create your models here.
class Sample(models.Model):
    sample = models.CharField(max_length=50)
    task = models.ForeignKey(Task, on_delete=models.SET_NULL, blank=True, null=True, related_name='t_samples')
    collection_date = models.DateField(null=True, blank=True)
    species = models.CharField(max_length=100, null=True, blank=True)
    fraction = models.FloatField(default=0)
    passed_tbprofiler = models.BooleanField(default=False)
    passed_cryptic = models.BooleanField(default=False)
    mapped_reads = models.FloatField(null=True, blank=True)
    mapped_reads_pct = models.FloatField(null=True, blank=True)
    genome_depth = models.FloatField(null=True, blank=True)
    category = models.CharField(max_length=100, null=True, blank=True)


class Lineage(models.Model):
    sample = models.OneToOneField(Sample, on_delete=models.CASCADE, related_name="lineage")
    lin = models.CharField(max_length=100)
    family = models.CharField(max_length=100)
    rd = models.CharField(max_length=100)
    spoligotype = models.CharField(max_length=100)
    is_mixed = models.BooleanField(default=False)


class Drug(models.Model):
    name = models.CharField(max_length=100)
    abbr = models.CharField(max_length=10)
    man_order = models.IntegerField(null=True, blank=True)


class Catalog(models.Model):
    name = models.CharField(max_length=100)
    version = models.CharField(max_length=50)
    gene = models.CharField(max_length=100)
    variant = models.CharField(max_length=150)
    prediction = models.CharField(max_length=10)
    drug = models.ForeignKey(Drug, on_delete=models.CASCADE, related_name='d_catalogs')
    grade = models.CharField(max_length=100, null=True, blank=True)
    present_solo_r = models.IntegerField(null=True, blank=True)
    present_solo_s = models.IntegerField(null=True, blank=True)
    present_r = models.IntegerField(null=True, blank=True)
    present_s = models.IntegerField(null=True, blank=True)
    absent_r = models.IntegerField(null=True, blank=True)
    absent_s = models.IntegerField(null=True, blank=True)
    effect = models.CharField(max_length=150, null=True, blank=True)


class Mutation(models.Model):
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE, related_name='s_mutations')
    freq = models.FloatField(null=True, blank=True)
    depth = models.IntegerField(null=True, blank=True)
    variant = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='cat_mutations')


class UnverifiedMutation(models.Model):
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE, related_name='s_umutations')
    variant = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='cat_umutations')


class Meta(models.Model):
    name = models.CharField(max_length=150, null=True, blank=True)
    type = models.CharField(max_length=150, null=True, blank=True)
    man_order = models.IntegerField(null=True, blank=True)
