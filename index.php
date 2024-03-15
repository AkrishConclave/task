<?php

CONST DAYS = array(
    'пн', 'вт', 'ср', 'чт', 'пт' ,'сб', 'вс'
);

function getTimes($str)
{
    $data = array();

    preg_match_all('/\b\d+(\.|\:)\d+\b/', $str, $matches);

    $numbers = $matches[0];

    foreach ($numbers as $number) {
        if(strlen($number) === 4)
        {
            $number = '0'.$number;
        }
        $number = str_replace('.', ':', $number);
        $data[] = $number;
    }

    return $data;
}

function getDays($str)
{
    $days = str_replace('-', ' ', $str);
    $day = explode(' ', $days);

    if(in_array($day[0],DAYS) && in_array($day[1],DAYS)){
        $key[] = array_search($day[0], DAYS);
        $key[] = array_search($day[1], DAYS);
        return $key;
    }
    else {
        $key = array_search($day[0], DAYS);
        return $key;
    }
}

function build($str)
{
    $data = array();

    $days = getDays($str);
    $times = getTimes($str);

    if(isset($days[1]) && count($times) === 4){
        for ($i = $days[0]; $i <= $days[1]; $i++)
        {
            $data[0][DAYS[$i]]['begin'] = $times[0];
            $data[0][DAYS[$i]]['end'] = $times[1];
            $data[1][DAYS[$i]]['begin'] = $times[2];
            $data[1][DAYS[$i]]['end'] = $times[3];
        }
    }
    elseif(isset($days[1])){
        for ($i = $days[0]; $i <= $days[1]; $i++)
        {
            $data[DAYS[$i]]['begin'] = $times[0];
            $data[DAYS[$i]]['end'] = $times[1];
        }
    }
    else{
        $data[DAYS[$days]]['begin'] = $times[0];
        $data[DAYS[$days]]['end'] = $times[1];
    }

    return $data;
}

$str1 = 'пн-ср с 9.00 до 20.00';
$str2 = 'вт с 10:00 до 20:00';
$str3 = 'пн-вс с 10.20 до 20.00, перерыв с 12:00 до 13.00';

var_dump(build($str3));