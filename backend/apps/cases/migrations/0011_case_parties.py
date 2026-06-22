from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cases", "0010_case_finance_dates"),
    ]

    operations = [
        migrations.AddField(
            model_name="case",
            name="parties",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
